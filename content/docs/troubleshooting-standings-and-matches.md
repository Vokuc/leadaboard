---
slug: "troubleshooting-standings-and-matches"
title: "Troubleshooting Standings and Match Scores"
description: "How to resolve standings delays, tie-breaker discrepancies, draw conflicts, and bracket advancement issues."
category: "Troubleshooting & FAQ"
order: 1
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["troubleshooting", "standings", "brackets", "fixes"]
related: ["troubleshooting-embeds-and-access", "correcting-match-results"]
---

# Troubleshooting Standings and Match Scores

If you encounter unexpected behavior in standings calculations or tournament brackets, use this troubleshooting guide to identify the root cause and apply a safe fix.

---

## Issue 1: Match was completed, but standings did not update

### Likely Causes:
- The fixture was saved as **"In Progress"** rather than **"Completed"**.
- Browser client caching delay.

### Safe Fix:
1. Open the fixture in your dashboard and ensure its status dropdown is explicitly set to **Completed**.
2. Perform a hard refresh in your browser (`Ctrl + F5` on Windows or `Cmd + Shift + R` on Mac).
3. If scores were edited, open the **Result Audit Drawer** to verify the active revision number.

---

## Issue 2: Tournament bracket winner did not advance to next round

### Likely Causes:
- The match score was entered as a **Draw (Tie)** without selecting a decisive penalty/overtime winner. Single-elimination brackets require a confirmed winner.

### Safe Fix:
1. Click on the match card on the bracket canvas.
2. Under "Winning Team", explicitly choose the advancing squad.
3. Click "Confirm Match Outcome". The winner's card will animate and populate the next round slot immediately.

---

## Issue 3: Two teams are tied on points, but the wrong team is ranked higher

### Likely Causes:
- The tie-breaker hierarchy order in your rules differs from what you expected.

### Safe Fix:
1. Open your league dashboard and navigate to the **"Rules & Scoring"** tab.
2. Inspect the **Tie-Breaker Hierarchy**:
   - If Goal Difference (`GD`) is prioritized, the team with superior GD is ranked higher.
   - If Head-to-Head is prioritized, the winner of their direct match is ranked higher.
3. Drag and drop the tie-breakers to reflect your official competition rulebook, then click **"Save Rules"**. Standings re-order automatically.
