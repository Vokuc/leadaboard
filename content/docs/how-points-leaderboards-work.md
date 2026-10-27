---
slug: "how-points-leaderboards-work"
title: "How Points-Based Leaderboards Work"
description: "A deep dive into continuous point accumulation, discrete score events, and real-time public updates."
category: "Leaderboards & Scoring"
order: 1
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["points", "scoring", "events", "realtime"]
related: ["configuring-scoring-rules", "updating-scores-and-audit-history"]
---

# How Points-Based Leaderboards Work

The **Simple Points Engine** powers continuous ranking competitions. Rather than matching participants in binary fixtures, members earn or lose points through discrete events over time.

---

## Core Principles

1. **Discrete Score Events**: Every point adjustment is logged as an immutable event with a timestamp, author identifier, point delta, and rule category.
2. **Deterministic Total Scores**: A competitor's total score is the exact sum of all active score events attributed to them.
3. **Instant Ranking Re-calculation**: When a score event is submitted, rankings across the entire board update automatically.
4. **Live Realtime Broadcasting**: Public viewers on `/leaderboards/[slug]` see ranks shuffle, numbers tick up, and celebratory confetti fire without refreshing the browser.

---

## Use Cases

- **Sales & Revenue Sprints**: Award points for calls placed, qualified demos booked, and contracts signed.
- **Gym & Fitness Challenges**: Track reps completed, workout consistency streaks, and weight milestones.
- **Gaming & Arcade High Scores**: Record match XP, headshots, or speedrun completion times.
- **Education & Hackathons**: Award points for homework completed, pull requests merged, or quiz scores.

---

## The Public Podium Display

The top three ranked competitors are highlighted on an elevated **Gold, Silver, and Bronze Podium**:
- 1st Place: Center, elevated gold podium with crown badge.
- 2nd Place: Left, silver tier.
- 3rd Place: Right, bronze tier.

Competitors ranked 4th and below appear in the full sortable standings list directly below the podium.
