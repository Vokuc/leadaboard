---
slug: "bracket-sizes-seeding-and-byes"
title: "Bracket Sizes, Seeding, and Byes"
description: "How seeding algorithms position competitors and how automatic byes handle uneven participant numbers."
category: "Tournaments & Brackets"
order: 2
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["seeding", "byes", "brackets", "tournament-sizes"]
related: ["creating-a-tournament", "managing-matches-and-advancing-winners"]
---

# Bracket Sizes, Seeding, and Byes

A well-balanced bracket prevents top competitors from eliminating each other in the opening round and gracefully handles uneven participant pools.

---

## Seeding Methods Supported

1. **Random Seeding**: Shuffles the registered participants and places them into bracket slots using a cryptographically randomized algorithm. Ideal for casual community cups or preliminary qualifiers.
2. **Ranked / Seeded Draw**: Places top seeds (Seed #1, Seed #2, etc.) at opposite ends of the bracket tree so they can only meet in the Grand Final.
   - Match 1: Seed #1 vs Seed #8
   - Match 2: Seed #4 vs Seed #5
   - Match 3: Seed #2 vs Seed #7
   - Match 4: Seed #3 vs Seed #6
3. **Manual Seeding**: Drag and drop teams into exact bracket positions based on your tournament committee's discretion.

---

## How Byes Work

A **Bye** occurs when the number of participants is not an exact power of two (e.g., 6 teams in an 8-team bracket, or 12 teams in a 16-team bracket).

### Automatic Bye Placement:
$$\text{Number of Byes} = \text{Next Power of Two} - \text{Total Participants}$$
For example, with 6 participants in an 8-slot bracket, there are $8 - 6 = 2$ Byes.

LeaderboardOS automatically:
1. Awards Byes to the highest-ranked seeds (Seed #1 and Seed #2).
2. Advances those seeded teams automatically into Round 2 (Quarter-Finals) without requiring a Round 1 match.
3. Pairs the remaining unseeded teams in Round 1 matches.
