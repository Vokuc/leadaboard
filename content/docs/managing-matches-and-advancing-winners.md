---
slug: "managing-matches-and-advancing-winners"
title: "Managing Matches and Advancing Winners"
description: "How to enter tournament scores in the interactive bracket and understand automatic winner progression."
category: "Tournaments & Brackets"
order: 3
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["brackets", "advancement", "winners", "progression"]
related: ["creating-a-tournament", "bracket-sizes-seeding-and-byes"]
---

# Managing Matches and Advancing Winners

LeaderboardOS features an interactive, visual bracket interface that automatically calculates downstream bracket progression when match winners are confirmed.

---

## Entering Match Outcomes

1. In your tournament dashboard, switch to the **"Bracket"** tab.
2. Locate the active match node on the bracket canvas.
3. Click on the match card to open the **Match Outcome Modal**.
4. Enter the final score (e.g. `Team A: 2, Team B: 0`).
5. Select the confirmed **Winning Team**.
6. Click **"Confirm Match Outcome"**.

---

## Automatic Winner Advancement

Once a winner is confirmed:
- The bracket tree calculates the parent match index:
  $$\text{Parent Match Slot} = \lfloor \text{Match Index} / 2 \rfloor$$
- The winning team's name, logo, and seed number automatically animate and populate the corresponding slot in the subsequent round.
- The eliminated team is grayed out, recording their final tournament exit rank.
- Spectators viewing on `/leaderboards/[slug]` or external embeds see the bracket advance in real time.

---

## Resolving Draws in Elimination Tournaments

Knockout tournaments cannot end in a draw. If a match is tied at the end of regulation time:
1. Conduct your overtime, penalty shootout, or tie-break round.
2. Input the regulation score and final tie-break result.
3. Explicitly designate the winning team in the modal before saving.
