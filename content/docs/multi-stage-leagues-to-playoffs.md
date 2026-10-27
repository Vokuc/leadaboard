---
slug: "multi-stage-leagues-to-playoffs"
title: "Multi-Stage Competitions: Leagues to Playoffs"
description: "How to connect a round-robin group stage to a knockout playoff bracket and seed qualifiers automatically."
category: "Tournaments & Brackets"
order: 4
readTime: "4 min read"
lastUpdated: "2026-10-27"
tags: ["multi-stage", "pathways", "playoffs", "groups"]
related: ["creating-a-tournament", "creating-a-league-table"]
---

# Multi-Stage Competitions: Leagues to Playoffs

Many major sporting and gaming events follow a two-phase structure: a preliminary **Round-Robin Group Stage**, followed by a **Championship Knockout Playoff**.

LeaderboardOS connects these stages natively through the **Competition Pathways Engine**.

---

## How Multi-Stage Pathways Work

1. **Phase 1 (League Stage)**: Teams compete across regular matchdays, earning points and establishing an official standings table.
2. **Phase 2 (Knockout Playoff)**: A single-elimination tournament bracket where seeds are populated directly from the final rankings of Phase 1.

---

## Step-by-Step Setup

### Step 1: Create Both Competitions
1. Create your Group Stage league competition (e.g. *Championship Group Stage*).
2. Create your Playoff tournament competition (e.g. *Championship Playoffs*).

### Step 2: Establish the Pathway Connection
1. In your Group Stage dashboard, navigate to the **"Stages & Pathways"** tab.
2. Click **"Connect Knockout Playoff"**.
3. Select your target Playoff tournament from the dropdown.
4. Specify the **Qualification Cutoff**:
   - e.g., *"Top 4 teams advance to Semi-Finals"* or *"Top 8 teams advance to Quarter-Finals"*.
5. Click **"Save Pathway"**.

### Step 3: Advance Qualifiers Upon League Completion
1. When all league matchdays are finished and scores finalized, click **"Finalize Stage & Advance Qualifiers"**.
2. LeaderboardOS maps the top $K$ teams into corresponding bracket slots:
   - Rank 1 $\rightarrow$ Seed #1
   - Rank 2 $\rightarrow$ Seed #2
   - Rank 3 $\rightarrow$ Seed #3
   - Rank 4 $\rightarrow$ Seed #4
3. The playoff bracket is immediately populated and ready for elimination fixtures.
