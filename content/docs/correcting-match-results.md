---
slug: "correcting-match-results"
title: "Correcting or Updating Match Results"
description: "How to edit finalized match results with mandatory reason logging and inspect score revision history."
category: "League Tables"
order: 4
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["corrections", "disputes", "audit", "revisions"]
related: ["managing-fixtures-and-match-results", "updating-scores-and-audit-history"]
---

# Correcting or Updating Match Results

If a score is entered incorrectly or overturned following an official referee match review, LeaderboardOS allows authorized organizers to submit corrections while preserving full historical transparency.

---

## Step-by-Step Result Correction

1. Navigate to the **"Fixtures"** tab in your league dashboard.
2. Find the completed match requiring correction.
3. Click the `...` menu and select **"Edit Result / File Correction"**.
4. Enter the corrected final score (e.g., changing `2 - 1` to `2 - 2`).
5. **Mandatory Step**: Enter the **Change Reason** (e.g., *"Official referee scorecard transcription error; disputed goal overturned by VAR"*).
6. Optional: Paste an **Evidence URL** (e.g. video recording or official referee match sheet).
7. Click **"Apply Correction"**.

---

## What Happens Behind the Scenes

- The previous score is archived into `fixture_result_history` with an incremented revision counter.
- The new score becomes active.
- League points, goal differences, and standings positions are deterministically recomputed from the active version.
- The fixture card displays a discreet **"Edited (Rev #)"** badge.

---

## The Result Audit Drawer

Anyone inspecting the match can click on the **"Edited"** badge to open the [ResultAuditDrawer](file:///c:/Users/DELL/Documents/leaderboard/src/components/competition/ResultAuditDrawer.tsx). 

The drawer reveals:
- When the original result was entered and by whom.
- When the correction was made.
- The exact reason provided by the administrator.
- The direct link to the supporting evidence document.

This auditability protects tournament directors from accusations of favoritism or retroactive tampering.
