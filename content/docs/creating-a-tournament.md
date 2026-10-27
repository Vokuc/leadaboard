---
slug: "creating-a-tournament"
title: "Creating a Knockout Tournament"
description: "How to set up a single-elimination tournament, choose bracket capacity, and configure match formats."
category: "Tournaments & Brackets"
order: 1
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["tournaments", "knockout", "brackets", "setup"]
related: ["bracket-sizes-seeding-and-byes", "managing-matches-and-advancing-winners"]
---

# Creating a Knockout Tournament

A **Knockout Tournament** is an elimination competition where winners advance through progressive rounds (Round of 16, Quarter-Finals, Semi-Finals, and Final) until a champion is crowned.

---

## Step 1: Initialize Tournament

1. Open `/dashboard/create`.
2. Select the **"Knockout Tournament"** format, or choose the **"Esports Knockout"** preset.
3. Enter your competition title (e.g. *Lagos Tekken 8 Invitational*) and custom URL slug.
4. Click **"Create Competition"**.

---

## Step 2: Choose Bracket Size

Knockout brackets follow binary power-of-two participant structures:
- **4 Participants**: 2 Semi-Finals + 1 Final.
- **8 Participants**: 4 Quarter-Finals + 2 Semi-Finals + 1 Final.
- **16 Participants**: Round of 16 $\rightarrow$ Quarter-Finals $\rightarrow$ Semi-Finals $\rightarrow$ Final.
- **32 or 64 Participants**: Multi-round championship brackets.

If your registered team count does not match an exact power of two, LeaderboardOS automatically awards **Byes** to the highest-seeded participants in Round 1.

---

## Step 3: Register Competitors

In the **"Bracket"** tab:
1. Add individual players or teams to the competitor pool.
2. Choose your seeding method (Random, Manual, or Ranked Seeding).
3. Click **"Generate Bracket"**.

Your interactive bracket renders immediately on screen, ready for match play.
