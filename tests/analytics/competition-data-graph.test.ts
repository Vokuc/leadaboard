import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService, mockDb } from '@/lib/db';
import { CompetitionGraphService } from '@/lib/analytics/competition-graph';
import { CompetitionSchedulingService } from '@/lib/competition/scheduling/service';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import { Fixture, FixtureResult, ParticipantClaim } from '@/types';

describe('Competition Data Graph & Cross-Competition Analytics (Era 7 Prompt 2)', () => {
  const organizerId = 'creator-user-id';

  beforeEach(() => {
    CompetitionGraphService.clearCache();
    mockDb.setProfile({
      id: organizerId,
      email: 'creator@leaderboardos.com',
      full_name: 'Organizer User',
      role: 'super_admin',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockDb.setLeaderboards([]);
    mockDb.set('teams', []);
    mockDb.set('team_name_history', []);
    mockDb.set('competition_participations', []);
    mockDb.set('fixtures', []);
    mockDb.set('fixture_results', []);
    mockDb.set('competition_venues', []);
    mockDb.setParticipantProfiles([]);
    mockDb.setParticipantClaims([]);
    mockDb.setParticipantTeamHistory([]);
  });

  // --------------------------------------------------------------------------
  // 1. HISTORICAL TEAM RENAMES & RECORD PRESERVATION
  // --------------------------------------------------------------------------
  it('preserves historical team identity across renames without mutating past competition records', async () => {
    // 1. Create competition and team
    const lb = await DatabaseService.createLeaderboard({
      name: 'Premier League 2024',
      slug: 'pl-2024',
      competition_type: 'sports',
      visibility: 'public',
    });

    const team = await DatabaseService.createTeam(lb.id, {
      name: 'Strikers FC',
      short_code: 'STR',
    });

    // 2. Record historical participation under original name
    await CompetitionGraphService.recordParticipation({
      leaderboard_id: lb.id,
      entity_type: 'team',
      member_id: team.id,
      team_id: team.id,
      display_name: 'Strikers FC',
      team_name_snapshot: 'Strikers FC',
      is_verified: true,
      final_position: 1,
      matches_played: 10,
      matches_won: 8,
      matches_drawn: 1,
      matches_lost: 1,
      total_points: 25,
      verified_matches_count: 10,
      unverified_matches_count: 0,
    });

    // 3. Rename team for next season
    const renameEntry = await CompetitionGraphService.recordTeamNameChange({
      teamId: team.id,
      newName: 'Apex Strikers',
      shortCode: 'APX',
      reason: 'Rebranding for 2025 season',
      actorUserId: organizerId,
    });

    expect(renameEntry.name).toBe('Strikers FC');
    expect(renameEntry.reason).toBe('Rebranding for 2025 season');

    // 4. Verify team name history
    const history = await CompetitionGraphService.getTeamNameHistory(team.id);
    expect(history.length).toBe(1);
    expect(history[0].name).toBe('Strikers FC');

    // 5. Verify that the previous season participation still has "Strikers FC" snapshot
    const participations = await CompetitionGraphService.getParticipations({
      leaderboardId: lb.id,
      teamId: team.id,
    });
    expect(participations.length).toBe(1);
    expect(participations[0].team_name_snapshot).toBe('Strikers FC');
  });

  // --------------------------------------------------------------------------
  // 2. PARTICIPANT TEAM TRANSFERS ACROSS SEASONS
  // --------------------------------------------------------------------------
  it('correctly tracks participant team transitions across competitions without retroactively altering past affiliations', async () => {
    const userId = 'usr-athlete-1';

    // Affiliation in Season 1
    await CompetitionPassportService.recordTeamAffiliation({
      user_id: userId,
      member_id: 'mem-1',
      leaderboard_id: 'lb-season-1',
      team_id: 'team-red',
      team_name: 'Red Dragons',
      role: 'captain',
      joined_at: '2024-01-01T00:00:00Z',
    });

    // Close affiliation
    await CompetitionPassportService.closeTeamAffiliation('team-red', 'mem-1');

    // Affiliation in Season 2
    await CompetitionPassportService.recordTeamAffiliation({
      user_id: userId,
      member_id: 'mem-2',
      leaderboard_id: 'lb-season-2',
      team_id: 'team-blue',
      team_name: 'Blue Phoenix',
      role: 'player',
      joined_at: '2025-01-01T00:00:00Z',
    });

    const allAffiliations = mockDb.getParticipantTeamHistory();
    const userHistory = allAffiliations.filter((h) => h.user_id === userId);

    expect(userHistory.length).toBe(2);
    expect(userHistory[0].team_name).toBe('Red Dragons');
    expect(userHistory[0].left_at).toBeDefined();
    expect(userHistory[1].team_name).toBe('Blue Phoenix');
    expect(userHistory[1].left_at).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 3. NO FALSE IDENTITY MERGES (DUPLICATE NAMES GUARD)
  // --------------------------------------------------------------------------
  it('does NOT merge two participants into the same career record based only on identical names', async () => {
    // Competitor A with verified profile
    await CompetitionPassportService.getOrCreateProfile('usr-real-alex', {
      username: 'alex_verified',
      display_name: 'Alex Johnson',
    });

    const lb1 = await DatabaseService.createLeaderboard({
      name: 'Championship A',
      slug: 'champ-a',
      competition_type: 'sports',
      visibility: 'public',
    });

    const member1 = await DatabaseService.addMember(lb1.id, {
      name: 'Alex Johnson',
      is_active: true,
    });

    // Set verified claim for Competitor A
    const claim: ParticipantClaim = {
      id: 'claim-1',
      leaderboard_id: lb1.id,
      member_id: member1.id,
      user_id: 'usr-real-alex',
      status: 'verified',
      verification_method: 'organizer_approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockDb.set('participant_claims', [claim]);

    // Competitor B in another tournament with identical display name but DIFFERENT identity (no claim)
    const lb2 = await DatabaseService.createLeaderboard({
      name: 'Local Chess Cup',
      slug: 'chess-cup',
      competition_type: 'gaming',
      visibility: 'public',
    });

    await DatabaseService.addMember(lb2.id, {
      name: 'Alex Johnson', // Same name, unverified/separate individual
      is_active: true,
    });

    // Query career summary for verified Alex
    const alexSummary = await CompetitionGraphService.getParticipantCrossCompetitionSummary('alex_verified');

    expect(alexSummary).not.toBeNull();
    // Only verified claims should appear in career participations
    expect(alexSummary?.participations.length).toBe(1);
    expect(alexSummary?.participations[0].competition_id).toBe(lb1.id);
    // Should NOT contain the unlinked Local Chess Cup
    expect(alexSummary?.participations.some((p) => p.competition_id === lb2.id)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 4. VERIFIED VS UNVERIFIED RESULT SEPARATION
  // --------------------------------------------------------------------------
  it('accurately categorizes verified, unverified, and disputed results without contaminating verified statistics', async () => {
    const lb = await DatabaseService.createLeaderboard({
      name: 'Championship League',
      slug: 'champ-league',
      competition_type: 'sports',
      visibility: 'public',
    });

    // Add fixtures and results with diverse statuses
    const fix1: Fixture = {
      id: 'fix-1',
      leaderboard_id: lb.id,
      home_member_id: 'm1',
      away_member_id: 'm2',
      status: 'completed',
      round_name: 'Round 1',
      round_index: 1,
      scheduled_at: null,
      created_at: new Date().toISOString(),
    };
    const fix2: Fixture = {
      id: 'fix-2',
      leaderboard_id: lb.id,
      home_member_id: 'm3',
      away_member_id: 'm4',
      status: 'completed',
      round_name: 'Round 1',
      round_index: 1,
      scheduled_at: null,
      created_at: new Date().toISOString(),
    };
    const fix3: Fixture = {
      id: 'fix-3',
      leaderboard_id: lb.id,
      home_member_id: 'm1',
      away_member_id: 'm3',
      status: 'completed',
      round_name: 'Round 2',
      round_index: 2,
      scheduled_at: null,
      created_at: new Date().toISOString(),
    };
    const fix4: Fixture = {
      id: 'fix-4',
      leaderboard_id: lb.id,
      home_member_id: 'm2',
      away_member_id: 'm4',
      status: 'completed',
      round_name: 'Round 2',
      round_index: 2,
      scheduled_at: null,
      created_at: new Date().toISOString(),
    };
    mockDb.set('fixtures', [fix1, fix2, fix3, fix4]);

    const res1: FixtureResult = { id: 'res-1', fixture_id: 'fix-1', home_score: 2, away_score: 1, status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const res2: FixtureResult = { id: 'res-2', fixture_id: 'fix-2', home_score: 0, away_score: 0, status: 'confirmed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const res3: FixtureResult = { id: 'res-3', fixture_id: 'fix-3', home_score: 3, away_score: 2, status: 'submitted', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; // unverified
    const res4: FixtureResult = { id: 'res-4', fixture_id: 'fix-4', home_score: 1, away_score: 1, status: 'disputed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };  // disputed
    mockDb.set('fixture_results', [res1, res2, res3, res4]);

    const analytics = await CompetitionGraphService.getOrganizerAnalytics({ ownerId: organizerId });

    expect(analytics.match_verification.total).toBe(4);
    expect(analytics.match_verification.verified).toBe(2);
    expect(analytics.match_verification.unverified).toBe(1);
    expect(analytics.match_verification.disputed).toBe(1);
    expect(analytics.match_verification.verified_rate_pct).toBe(50);
  });

  // --------------------------------------------------------------------------
  // 5. VENUE UTILIZATION ACROSS COMPETITIONS
  // --------------------------------------------------------------------------
  it('aggregates venue utilization metrics across multiple competitions', async () => {
    const lb1 = await DatabaseService.createLeaderboard({
      name: 'League A',
      slug: 'league-a',
      competition_type: 'sports',
      visibility: 'public',
    });

    // Create a shared court/field
    const venue = await CompetitionSchedulingService.createVenue({
      leaderboardId: lb1.id,
      name: 'Main Stadium',
      courtField: 'Court 1',
      capacity: 500,
    });

    // Schedule fixtures on this venue in lb1
    mockDb.set('fixtures', [
      { id: 'f-1', leaderboard_id: lb1.id, venue_id: venue.id, status: 'completed', home_member_id: 'm1', away_member_id: 'm2', round_name: '1', round_index: 1, scheduled_at: null, created_at: new Date().toISOString() },
      { id: 'f-2', leaderboard_id: lb1.id, venue_id: venue.id, status: 'scheduled', home_member_id: 'm3', away_member_id: 'm4', round_name: '1', round_index: 1, scheduled_at: null, created_at: new Date().toISOString() },
    ]);

    const analytics = await CompetitionGraphService.getOrganizerAnalytics({ ownerId: organizerId });
    const stadium = analytics.venues_utilization.find((v) => v.venue_id === venue.id);

    expect(stadium).toBeDefined();
    expect(stadium?.venue_name).toBe('Main Stadium');
    expect(stadium?.court_field).toBe('Court 1');
    expect(stadium?.total_matches_scheduled).toBe(2);
    expect(stadium?.completed_matches).toBe(1);
  });

  // --------------------------------------------------------------------------
  // 6. CSV EXPORT INTEGRITY & RFC 4180 PRIVACY COMPLIANCE
  // --------------------------------------------------------------------------
  it('generates properly escaped RFC 4180 CSV exports with privacy controls', async () => {
    // Test escapeCsv with commas and quotes
    const escaped1 = CompetitionGraphService.escapeCsv('Normal Name');
    expect(escaped1).toBe('Normal Name');

    const escaped2 = CompetitionGraphService.escapeCsv('Team "Thunder", City');
    expect(escaped2).toBe('"Team ""Thunder"", City"');

    // Create leaderboard with special characters
    const lb = await DatabaseService.createLeaderboard({
      name: 'City Cup, "Summer Edition"',
      slug: 'city-cup-summer',
      competition_type: 'sports',
      visibility: 'public',
    });

    await DatabaseService.addMember(lb.id, {
      name: 'Jane "Ace" Doe, Jr.',
      email: 'private.jane@example.com', // Should be excluded from public member export
      team: 'Eagles, Inc.',
    });

    const csv = await CompetitionGraphService.exportParticipationsCsv(lb.id, organizerId);

    // Verify headers
    expect(csv).toContain('Member ID,Name,Team,Active Status,Competition Name,Joined At');
    // Verify escaping
    expect(csv).toContain('"Jane ""Ace"" Doe, Jr."');
    expect(csv).toContain('"Eagles, Inc."');
    // Verify private email is omitted
    expect(csv).not.toContain('private.jane@example.com');
  });

  // --------------------------------------------------------------------------
  // 7. IN-MEMORY CACHE PREVENTS UNBOUNDED SCAN REPETITION
  // --------------------------------------------------------------------------
  it('caches aggregate analytics to protect database from expensive unbounded queries', async () => {
    await DatabaseService.createLeaderboard({
      name: 'Fast League',
      slug: 'fast-league',
      competition_type: 'fitness',
      visibility: 'public',
    });

    const result1 = await CompetitionGraphService.getOrganizerAnalytics({ ownerId: organizerId });
    const result2 = await CompetitionGraphService.getOrganizerAnalytics({ ownerId: organizerId });

    expect(result1.total_competitions).toBe(result2.total_competitions);
    // Second call should return cached object instance
    expect(result1).toBe(result2);
  });
});
