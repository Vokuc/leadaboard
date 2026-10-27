import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompetitionPaymentService } from '@/lib/payments/competition/service';
import { CompetitionRegistrationService } from '@/lib/competition/registration/service';
import { validatePaymentDeadline } from '@/lib/competition/registration/validation';
import { DatabaseService, mockDb } from '@/lib/db';
import { Leaderboard, LeaderboardMember } from '@/types';

describe('Paid Competition Registration & Financial Ledger', () => {
  const TEST_LEADERBOARD_ID = 'test-paid-competition-1';
  const ORGANIZER_USER_ID = 'creator-user-id';

  let testMembers: LeaderboardMember[] = [];

  beforeEach(async () => {
    vi.restoreAllMocks();

    // Reset mock storage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    mockDb.setCompetitionPayments([]);
    mockDb.setCompetitionLedgerEntries([]);
    mockDb.setCompetitionRefunds([]);
    mockDb.setCompetitionPrizeAllocations([]);
    testMembers = [];

    // Reset default registration config
    await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
      is_enabled: true,
      entry_fee: null,
      currency: 'NGN',
      payment_deadline: null,
      refund_policy: 'no_refunds',
      platform_fee_percent: 5,
      prize_pool_percentage: 0,
      guaranteed_prize_pool: null,
    });

    // Seed test competition
    const testLeaderboard: Leaderboard = {
      id: TEST_LEADERBOARD_ID,
      name: 'Championship Cup 2026',
      slug: 'championship-cup-2026',
      description: 'Annual competitive tournament with entry fee and prize pool',
      competition_type: 'tournament',
      scoring_type: 'points',
      visibility: 'public',
      owner_id: ORGANIZER_USER_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingBoards = mockDb.getLeaderboards();
    mockDb.setLeaderboards([...existingBoards.filter((b) => b.id !== TEST_LEADERBOARD_ID), testLeaderboard]);

    vi.spyOn(DatabaseService, 'getLeaderboard').mockImplementation(async (id: string) => {
      if (id === TEST_LEADERBOARD_ID || id === 'championship-cup-2026') return testLeaderboard;
      return null;
    });

    vi.spyOn(DatabaseService, 'getLeaderboardById').mockImplementation(async (id: string) => {
      if (id === TEST_LEADERBOARD_ID) return testLeaderboard;
      return null;
    });

    vi.spyOn(DatabaseService, 'getMembers').mockImplementation(async (id: string) => {
      if (id === TEST_LEADERBOARD_ID) return [...testMembers];
      return [];
    });

    vi.spyOn(DatabaseService, 'addMember').mockImplementation(
      async (leaderboardId: string, memberData: Omit<LeaderboardMember, 'id' | 'leaderboard_id' | 'created_at' | 'updated_at'>) => {
        const newM: LeaderboardMember = {
          id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          leaderboard_id: leaderboardId,
          name: memberData.name,
          email: memberData.email,
          team: memberData.team || null,
          team_id: memberData.team_id || null,
          avatar_url: memberData.avatar_url,
          notes: memberData.notes,
          is_active: true,
          user_id: memberData.user_id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        testMembers.push(newM);
        return newM;
      }
    );

    vi.spyOn(DatabaseService, 'updateMember').mockImplementation(
      async (
        memberIdOrLeaderboardId: string,
        memberIdOrUpdates: string | Partial<LeaderboardMember>,
        updatesArg?: Partial<LeaderboardMember>
      ) => {
        const memberId = typeof memberIdOrUpdates === 'string' ? memberIdOrUpdates : memberIdOrLeaderboardId;
        const updates = typeof memberIdOrUpdates === 'object' ? memberIdOrUpdates : (updatesArg || {});
        const idx = testMembers.findIndex((m) => m.id === memberId);
        if (idx !== -1) {
          testMembers[idx] = { ...testMembers[idx], ...updates, updated_at: new Date().toISOString() };
          return testMembers[idx];
        }
        return null as unknown as LeaderboardMember;
      }
    );
  });

  describe('1. Free vs Paid Registration Flow', () => {
    it('confirms free registration immediately without creating payment or pending state', async () => {
      // Setup free config
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 0,
        currency: 'NGN',
        require_approval: false,
      });

      const checkout = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Alice Free',
        participantEmail: 'alice@free.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      expect(checkout.isPaid).toBe(false);
      expect(checkout.amount).toBe(0);
      expect(checkout.registration.status).toBe('confirmed');
      expect(checkout.registration.payment_status).toBeNull();

      // Check that participant was added to competition roster
      const members = await DatabaseService.getMembers(TEST_LEADERBOARD_ID);
      const member = members.find((m) => m.email === 'alice@free.com');
      expect(member).toBeDefined();
      expect(member?.name).toBe('Alice Free');
    });

    it('creates pending_payment registration and server-authoritative payment record for paid events', async () => {
      // 5,000 NGN entry fee (500000 minor units)
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 500000,
        currency: 'NGN',
        require_approval: false,
        platform_fee_percent: 5,
      });

      const checkout = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Bob Paid',
        participantEmail: 'bob@paid.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      expect(checkout.isPaid).toBe(true);
      expect(checkout.amount).toBe(500000);
      expect(checkout.currency).toBe('NGN');
      expect(checkout.paymentReference).toMatch(/^cpay_/);
      expect(checkout.registration.status).toBe('pending_payment');
      expect(checkout.registration.payment_status).toBe('pending');
      expect(checkout.registration.member_id).toBeNull(); // Must not be placed on active roster yet!

      // Roster must NOT include unconfirmed entrant
      const members = await DatabaseService.getMembers(TEST_LEADERBOARD_ID);
      const member = members.find((m) => m.email === 'bob@paid.com');
      expect(member).toBeUndefined();
    });
  });

  describe('2. Server Authority & Anti-Tampering', () => {
    it('strictly charges amount configured on the server, ignoring any client inputs', async () => {
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 750000, // 7,500 NGN
        currency: 'NGN',
      });

      const checkout = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Charlie Price',
        participantEmail: 'charlie@price.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      expect(checkout.amount).toBe(750000);

      const payment = await CompetitionPaymentService.getPaymentByReference(checkout.paymentReference!);
      expect(payment).toBeDefined();
      expect(payment?.amount).toBe(750000);
      expect(payment?.status).toBe('pending');
    });

    it('rejects checkout when payment deadline has expired', async () => {
      const pastDeadline = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 500000,
        currency: 'NGN',
        payment_deadline: pastDeadline,
      });

      const config = await CompetitionRegistrationService.getConfig(TEST_LEADERBOARD_ID);
      const deadlineValidation = validatePaymentDeadline(config);
      expect(deadlineValidation.valid).toBe(false);
      expect(deadlineValidation.error).toContain('passed');

      await expect(
        CompetitionPaymentService.initializeRegistrationCheckout({
          leaderboardId: TEST_LEADERBOARD_ID,
          participantName: 'Late Entrant',
          participantEmail: 'late@entrant.com',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
        })
      ).rejects.toThrow(/deadline.*passed/i);

      // Clean up deadline for subsequent tests
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        payment_deadline: null,
      });
    });
  });

  describe('3. Verified Payment & Double-Entry Ledger Tracking', () => {
    it('verifies payment, adds entrant to roster, and writes balanced double-entry ledger entries', async () => {
      // 10,000 NGN entry fee, 5% platform fee
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 1000000, // 10,000.00 NGN
        currency: 'NGN',
        platform_fee_percent: 5,
        require_approval: false,
      });

      const checkout = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'David Verified',
        participantEmail: 'david@verified.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      // Execute verified payment
      const verifyResult = await CompetitionPaymentService.verifyPayment(
        checkout.paymentReference!,
        ORGANIZER_USER_ID,
        { forceTestSuccess: true }
      );

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.payment.status).toBe('succeeded');
      expect(verifyResult.registration.status).toBe('confirmed');
      expect(verifyResult.registration.payment_status).toBe('succeeded');
      expect(verifyResult.registration.amount_paid).toBe(1000000);
      expect(verifyResult.registration.member_id).toBeDefined();

      // Entrant now present in official roster
      const members = await DatabaseService.getMembers(TEST_LEADERBOARD_ID);
      const member = members.find((m) => m.email === 'david@verified.com');
      expect(member).toBeDefined();
      expect(member?.is_active).toBe(true);

      // Verify financial summary & ledger
      const summary = await CompetitionPaymentService.getFinancialSummary(TEST_LEADERBOARD_ID);
      expect(summary.gross_revenue).toBe(1000000);
      expect(summary.total_paid_registrations).toBe(1);
      expect(summary.platform_fees).toBe(50000); // 5% of 10,000 NGN = 500 NGN (50000 minor)
      expect(summary.provider_fees).toBeGreaterThan(0);

      const expectedNet = 1000000 - summary.platform_fees - summary.provider_fees;
      expect(summary.organizer_balance).toBe(expectedNet);

      // Check individual ledger entries (gross fee credit, provider fee debit, platform fee debit)
      const entries = summary.entries;
      expect(entries.length).toBe(3);

      const grossEntry = entries.find((e) => e.entry_type === 'gross_entry_fee');
      expect(grossEntry).toBeDefined();
      expect(grossEntry?.credit_amount).toBe(1000000);
      expect(grossEntry?.debit_amount).toBe(0);

      const providerEntry = entries.find((e) => e.entry_type === 'provider_fee');
      expect(providerEntry).toBeDefined();
      expect(providerEntry?.debit_amount).toBe(summary.provider_fees);

      const platformEntry = entries.find((e) => e.entry_type === 'platform_fee');
      expect(platformEntry).toBeDefined();
      expect(platformEntry?.debit_amount).toBe(50000);

      // Receipt was generated with complete details
      expect(verifyResult.receipt).toBeDefined();
      expect(verifyResult.receipt.amount).toBe(1000000);
      expect(verifyResult.receipt.participantName).toBe('David Verified');
    });

    it('guarantees idempotency: replayed webhook or duplicate verification calls do not duplicate entries or double-credit balance', async () => {
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 500000,
        currency: 'NGN',
        platform_fee_percent: 5,
      });

      const checkout = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Emma Idempotent',
        participantEmail: 'emma@idempotent.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      // First verification
      const first = await CompetitionPaymentService.verifyPayment(
        checkout.paymentReference!,
        ORGANIZER_USER_ID,
        { forceTestSuccess: true }
      );
      expect(first.success).toBe(true);

      const summary1 = await CompetitionPaymentService.getFinancialSummary(TEST_LEADERBOARD_ID);
      const balance1 = summary1.organizer_balance;
      const ledgerCount1 = summary1.entries.length;

      // Second verification (simulating duplicate webhook replay or user refreshing browser)
      const second = await CompetitionPaymentService.verifyPayment(
        checkout.paymentReference!,
        ORGANIZER_USER_ID,
        { forceTestSuccess: true }
      );
      expect(second.success).toBe(true);

      const summary2 = await CompetitionPaymentService.getFinancialSummary(TEST_LEADERBOARD_ID);
      expect(summary2.organizer_balance).toBe(balance1); // Must not change!
      expect(summary2.entries.length).toBe(ledgerCount1); // Must not create extra ledger rows!
    });
  });

  describe('4. Refund Flow & State Transition Audit', () => {
    it('processes refund, debits ledger, updates registration to withdrawn, and deactivates member', async () => {
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 600000, // 6,000 NGN
        currency: 'NGN',
        platform_fee_percent: 5,
      });

      const checkout = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Frank Refund',
        participantEmail: 'frank@refund.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      await CompetitionPaymentService.verifyPayment(
        checkout.paymentReference!,
        ORGANIZER_USER_ID,
        { forceTestSuccess: true }
      );

      const summaryBefore = await CompetitionPaymentService.getFinancialSummary(TEST_LEADERBOARD_ID);
      const balanceBefore = summaryBefore.organizer_balance;

      // Process full refund
      const refundResult = await CompetitionPaymentService.processRefund({
        leaderboardId: TEST_LEADERBOARD_ID,
        registrationId: checkout.registration.id,
        reason: 'Competitor had scheduling conflict',
        actorUserId: ORGANIZER_USER_ID,
      });

      expect(refundResult.success).toBe(true);
      expect(refundResult.refund.amount).toBe(600000);
      expect(refundResult.refund.status).toBe('succeeded');

      // Check registration status transition
      const regAfter = await CompetitionRegistrationService.getRegistrationById(
        checkout.registration.id,
        TEST_LEADERBOARD_ID
      );
      expect(regAfter?.status).toBe('withdrawn');
      expect(regAfter?.payment_status).toBe('refunded');

      // Check member deactivated in roster
      const members = await DatabaseService.getMembers(TEST_LEADERBOARD_ID);
      const member = members.find((m) => m.email === 'frank@refund.com');
      expect(member?.is_active).toBe(false);

      // Check updated ledger summary
      const summaryAfter = await CompetitionPaymentService.getFinancialSummary(TEST_LEADERBOARD_ID);
      expect(summaryAfter.total_refunded).toBe(600000);
      expect(summaryAfter.refund_count).toBe(1);
      expect(summaryAfter.organizer_balance).toBe(balanceBefore - 600000);

      // Check refund debit entry in ledger
      const refundEntry = summaryAfter.entries.find((e) => e.entry_type === 'refund_debit');
      expect(refundEntry).toBeDefined();
      expect(refundEntry?.debit_amount).toBe(600000);
    });

    it('rejects refund if refund amount exceeds original charge', async () => {
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 400000,
        currency: 'NGN',
      });

      const checkout = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Grace Overrefund',
        participantEmail: 'grace@overrefund.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });

      await CompetitionPaymentService.verifyPayment(
        checkout.paymentReference!,
        ORGANIZER_USER_ID,
        { forceTestSuccess: true }
      );

      await expect(
        CompetitionPaymentService.processRefund({
          leaderboardId: TEST_LEADERBOARD_ID,
          registrationId: checkout.registration.id,
          reason: 'Excessive refund attempt',
          amount: 500000, // Greater than 400,000 paid!
          actorUserId: ORGANIZER_USER_ID,
        })
      ).rejects.toThrow(/exceeds/i);
    });
  });

  describe('5. Prize Pool Allocation as Double-Entry Accounting', () => {
    it('allocates prize pool against net organizer balance without fabricating unconfigured external payouts', async () => {
      // 2 entrants paying 10,000 NGN each
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 1000000,
        currency: 'NGN',
        platform_fee_percent: 5,
      });

      // Participant 1
      const c1 = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Player One',
        participantEmail: 'p1@comp.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });
      await CompetitionPaymentService.verifyPayment(c1.paymentReference!, ORGANIZER_USER_ID, { forceTestSuccess: true });

      // Participant 2
      const c2 = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Player Two',
        participantEmail: 'p2@comp.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });
      await CompetitionPaymentService.verifyPayment(c2.paymentReference!, ORGANIZER_USER_ID, { forceTestSuccess: true });

      const summaryBefore = await CompetitionPaymentService.getFinancialSummary(TEST_LEADERBOARD_ID);
      const netAvailable = summaryBefore.organizer_balance;
      expect(netAvailable).toBeGreaterThan(1500000);

      // Allocate prize pool: 1st place 10,000 NGN, 2nd place 5,000 NGN
      const prizeResult = await CompetitionPaymentService.allocatePrizePool({
        leaderboardId: TEST_LEADERBOARD_ID,
        allocations: [
          { rankPosition: 1, recipientName: 'Player One', amount: 1000000, notes: 'Champion' },
          { rankPosition: 2, recipientName: 'Player Two', amount: 500000, notes: 'Runner up' },
        ],
        actorUserId: ORGANIZER_USER_ID,
      });

      expect(prizeResult.success).toBe(true);
      expect(prizeResult.allocations.length).toBe(2);
      expect(prizeResult.allocations[0].payout_status).toBe('allocated'); // Transparent accounting, not fabricated transfer!

      const summaryAfter = await CompetitionPaymentService.getFinancialSummary(TEST_LEADERBOARD_ID);
      expect(summaryAfter.prize_pool_allocated).toBe(1500000);
      expect(summaryAfter.organizer_balance).toBe(netAvailable - 1500000);

      // Verify debit entries in ledger
      const prizeEntries = summaryAfter.entries.filter((e) => e.entry_type === 'prize_allocation_debit');
      expect(prizeEntries.length).toBe(2);
    });

    it('prevents allocating more than available net organizer revenue', async () => {
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 200000, // 2,000 NGN
        currency: 'NGN',
      });

      const c = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Solo Entrant',
        participantEmail: 'solo@comp.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });
      await CompetitionPaymentService.verifyPayment(c.paymentReference!, ORGANIZER_USER_ID, { forceTestSuccess: true });

      // Attempt to allocate 5,000 NGN when only ~1,900 NGN net exists
      await expect(
        CompetitionPaymentService.allocatePrizePool({
          leaderboardId: TEST_LEADERBOARD_ID,
          allocations: [
            { rankPosition: 1, recipientName: 'Winner', amount: 500000 },
          ],
          actorUserId: ORGANIZER_USER_ID,
        })
      ).rejects.toThrow(/exceeds available net balance/i);
    });
  });

  describe('6. Ledger Audit & Reconciliation Engine', () => {
    it('verifies that the ledger has zero drift and confirms mathematical balance', async () => {
      await CompetitionRegistrationService.saveConfig(TEST_LEADERBOARD_ID, {
        is_enabled: true,
        entry_fee: 500000,
        currency: 'NGN',
        platform_fee_percent: 5,
      });

      const c1 = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Reconcile 1',
        participantEmail: 'rec1@test.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });
      await CompetitionPaymentService.verifyPayment(c1.paymentReference!, ORGANIZER_USER_ID, { forceTestSuccess: true });

      const c2 = await CompetitionPaymentService.initializeRegistrationCheckout({
        leaderboardId: TEST_LEADERBOARD_ID,
        participantName: 'Reconcile 2',
        participantEmail: 'rec2@test.com',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      });
      await CompetitionPaymentService.verifyPayment(c2.paymentReference!, ORGANIZER_USER_ID, { forceTestSuccess: true });

      // Run reconciliation
      const reconciliation = await CompetitionPaymentService.reconcileLedger(TEST_LEADERBOARD_ID);

      expect(reconciliation.balanced).toBe(true);
      expect(reconciliation.discrepancy).toBe(0);
      expect(reconciliation.details.grossPayments).toBe(1000000);
      expect(reconciliation.details.actualBalance).toBe(reconciliation.details.calculatedNet);
    });
  });
});
