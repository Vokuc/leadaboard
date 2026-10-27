---
slug: "understanding-competition-types"
title: "Understanding Competition Types"
description: "Compare Simple Points Leaderboards, Round-Robin League Tables, and Knockout Tournaments to choose the best engine for your event."
category: "Getting Started"
order: 2
readTime: "4 min read"
lastUpdated: "2026-10-27"
tags: ["formats", "points", "leagues", "tournaments"]
related: ["what-is-leaderboardos", "creating-your-first-competition"]
---

# Understanding Competition Types

LeaderboardOS supports three competition engines. Each format is optimized for specific sporting, gaming, or workplace scenarios:

---

## 1. Simple Points Leaderboard (`simple_points`)

A continuous ranking board where individual members or teams accumulate points over time, or compete for the single highest score.

### Best Used For:
- Arcade and retro gaming high-score challenges.
- Corporate SDR and sales quota sprints (e.g., deals closed, meetings booked).
- Fitness rep challenges (e.g., push-up marathons, running mileage).
- Hackathons and bug bounties.

### Key Characteristics:
- **Scoring**: Points are added or deducted via discrete score events (e.g. `+50 Points for MVP`).
- **Podium**: Top 3 ranks are spotlighted on a gold/silver/bronze podium.
- **Ties**: Tied competitors share ranks, and the ranking table adjusts accordingly (e.g., 1st, 2nd, 2nd, 4th).

---

## 2. Round-Robin League Table (`league_table`)

A structured competition where clubs or teams play scheduled fixtures against one another across one or more rounds (matchdays).

### Best Used For:
- Football (soccer), basketball, and rugby leagues.
- Esports round-robin group stages (FIFA, Rocket League, CS:GO).
- Intramural school and college sports seasons.

### Key Characteristics:
- **Standings Table**: Tracks Played (`P`), Won (`W`), Drawn (`D`), Lost (`L`), Goals For (`GF`), Goals Against (`GA`), Goal Difference (`GD`), and Points (`PTS`).
- **Scoring**: Standard 3 points for a win, 1 point for a draw, 0 for a loss (fully customizable).
- **Tie-Breaker Hierarchy**: Prioritized cascades including Goal Difference, Goals Scored, and Head-to-Head results.
- **Fixture Scheduling**: Includes an automated round-robin schedule generator with venue and time slot assignments.

---

## 3. Knockout Elimination Tournament (`tournament`)

A binary bracket format where participants face off in head-to-head matches. Winners advance to the next round, while losers are eliminated.

### Best Used For:
- Weekend esports tournaments (Valorant, Tekken, Street Fighter).
- Cup competitions and playoff finals.
- Tennis, table tennis, and badminton championships.

### Key Characteristics:
- **Bracket Sizes**: 4, 8, 16, 32, or 64 participants.
- **Automatic Progression**: Advancing a match winner automatically slots them into the connected parent match in the next round.
- **Seeding**: Supports randomized seeding, manual placement, or seeding based on prior league standings.

---

## Multi-Stage Pathways (Connecting Formats)

You don't have to choose only one! LeaderboardOS supports **Multi-Stage Pathways**, allowing you to run a preliminary round-robin league stage and automatically advance the top qualifiers into a championship knockout tournament bracket.

---

## Next Steps

- [Creating Your First Competition](/docs/creating-your-first-competition)
- [Configuring Scoring Rules](/docs/configuring-scoring-rules)
