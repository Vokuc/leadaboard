---
slug: "updating-scores-and-audit-history"
title: "Updating Scores and Audit History"
description: "How score events are logged, why audit trails are immutable, and how organizers review changes."
category: "Leaderboards & Scoring"
order: 4
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["scores", "audit", "history", "provenance"]
related: ["how-points-leaderboards-work", "correcting-match-results"]
---

# Updating Scores and Audit History

In high-stakes sports leagues, corporate bonuses, and esports cups, score disputes can damage trust. LeaderboardOS enforces an **Append-Only Audit History** so that every point adjustment is verifiable.

---

## Logging a Score Event

1. In the competition dashboard, open the **"Scores"** tab.
2. Select the participant or team from the dropdown.
3. Pick the relevant scoring rule (e.g. `+20 Points - Hat-trick`).
4. Enter an optional event note (e.g., *"Match vs Team Alpha, 2nd half"*).
5. Click **"Submit Score Event"**.

The member's total score updates immediately, and a new record appears at the top of the **Activity Log**.

---

## Why Scores Are Immutable

Unlike generic database tools where rows are overwritten with `UPDATE` statements, LeaderboardOS records scores as discrete transactions in the database:
- Each event stores the exact timestamp and author ID.
- Direct row deletions or mutations are prevented by security rules.
- If points were awarded in error, the organizer submits a corrective offsetting entry (e.g. `-20 Points - Score Entry Error Correction`).

---

## Reviewing the Activity Log

Every competition includes an **Activity Log** available in both the organizer dashboard and the public overview tab:
- **Timestamp**: Exact date and time the score was entered.
- **Competitor Name**: Who received the points.
- **Rule & Reason**: The justification attached to the adjustment.
- **Author**: Which organizer or referee authorized the entry.

This transparent audit log ensures players, coaches, and sponsors have full confidence in the final competition standings.
