---
slug: "managing-fixtures-and-match-results"
title: "Managing Fixtures and Match Results"
description: "How to use the automated round-robin scheduler, assign venues, and input match scores."
category: "League Tables"
order: 2
readTime: "4 min read"
lastUpdated: "2026-10-27"
tags: ["fixtures", "scheduler", "results", "scores"]
related: ["creating-a-league-table", "correcting-match-results"]
---

# Managing Fixtures and Match Results

Managing a season schedule manually can lead to team venue clashes and unbalanced home/away fixtures. LeaderboardOS includes an automated **Round-Robin Scheduling Engine** to generate balanced match calendars instantly.

---

## 1. Generating an Automated Schedule

1. Open your league dashboard and navigate to the **"Scheduler"** tab.
2. Select your competition dates and match parameters:
   - **Start Date**: The season kick-off date.
   - **Matchdays**: Days of the week when matches occur (e.g. Saturday, Sunday).
   - **Venues**: Add playing surfaces (e.g. *Main Pitch*, *Court 1*, *Arena B*).
   - **Match Duration & Interval**: e.g., 60 minutes with 15 minutes between matches.
3. Click **"Generate Balanced Schedule"**.
4. The system pairs every team against every other team with balanced home and away assignments, zero team double-bookings, and venue allocations.

---

## 2. Entering Match Results

When a match concludes:
1. Open the **"Fixtures"** tab.
2. Filter by Round number or search for the competing teams.
3. Click **"Enter Result"** on the fixture row.
4. Input the Home Score and Away Score (e.g. `Home: 3, Away: 1`).
5. Click **"Save Result"**.

### What Happens Instantly:
- The match status changes to **Completed**.
- League points are awarded to the winner (or split in a draw).
- The league table standings re-calculate immediately.
- Public spectators on `/leaderboards/[slug]` see the score update in real time.

---

## 3. Postponing or Rescheduling Matches

If adverse weather or venue issues occur:
1. Click the `...` menu on the fixture.
2. Select **"Postpone Match"** or **"Change Venue / Kick-off Time"**.
3. Enter the updated date and venue. The public schedule reflects the change immediately.
