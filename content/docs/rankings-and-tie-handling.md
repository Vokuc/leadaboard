---
slug: "rankings-and-tie-handling"
title: "Rankings and Tie Handling"
description: "How leaderboard ranks are calculated and how ties are resolved across different competition engines."
category: "Leaderboards & Scoring"
order: 3
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["rankings", "ties", "tie-breakers", "calculations"]
related: ["how-points-leaderboards-work", "understanding-league-standings"]
---

# Rankings and Tie Handling

Fairness and clarity in competition standings depend on transparent ranking math and deterministic tie-handling rules.

---

## Tie Handling in Simple Points Leaderboards

In points-based leaderboards, rank positions are calculated by sorting participants by **Total Score** in descending order:

### Shared Ranks & Gap Advances
When two or more participants have the exact same score:
1. They are assigned the same rank.
2. The next participant's rank advances by the number of tied participants.

#### Example:
| Participant | Total Score | Displayed Rank |
| :--- | :--- | :--- |
| Sarah Connor | 150 pts | **Rank 1** |
| Alex Mercer | 120 pts | **Rank 2 (Tied)** |
| Elena Fisher | 120 pts | **Rank 2 (Tied)** |
| John Wick | 105 pts | **Rank 4** |

Notice that because Rank 2 is tied between two players, Rank 3 is skipped and the next competitor is assigned Rank 4.

---

## Tie Handling in League Tables

League competitions feature a multi-tier **Tie-Breaker Cascade**. If two teams have identical league points (`PTS`), LeaderboardOS evaluates tie-breakers in the exact order specified in your competition rules:

1. **Goal / Score Difference (`GD`)**: Goals Scored minus Goals Conceded.
2. **Goals / Points For (`GF`)**: Total goals or points scored during the season.
3. **Head-to-Head Result**: The direct match outcome between the two tied teams.
4. **Fair Play Points**: Fewer red or yellow disciplinary cards.
5. **Alphabetical / Coin Toss**: Final deterministic fallback.

You can customize this order by visiting the **"Rules & Scoring"** tab in your league dashboard.
