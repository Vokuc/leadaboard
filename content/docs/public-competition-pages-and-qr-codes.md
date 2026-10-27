---
slug: "public-competition-pages-and-qr-codes"
title: "Public Competition Pages and QR Codes"
description: "A guide to spectator features on public leaderboard pages: podium showcase, search, filters, and mobile QR codes."
category: "Sharing & Embeds"
order: 1
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["public-pages", "podium", "qr-codes", "spectators"]
related: ["embedding-competitions", "publishing-and-sharing"]
---

# Public Competition Pages and QR Codes

Every public competition on LeaderboardOS is rendered at a dedicated public page:
`https://leaderboardos.com/leaderboards/[slug]`

This page is designed for spectators, competitors, and sponsors to follow the action in real time.

---

## Key Spectator Features

### 1. Elevated Podium Showcase
The top 3 performers are spotlighted on a high-contrast Gold, Silver, and Bronze podium. Each podium step displays the player's or team's avatar, rank crown, total score, and recent trend indicator.

### 2. Search & Dynamic Filtering
Spectators can:
- Type in the **Search Box** to find specific competitors or squads.
- Filter by division or team.
- Switch between **Top 10**, **Top 50**, or **Full Standings**.

### 3. Realtime Live Sync
The page connects via WebSockets to our real-time replication engine. When an organizer or referee submits a score:
- Numbers tick up with smooth CSS transitions.
- Ranks re-sort with smooth layout animations.
- When a new 1st place champion emerges, celebratory confetti fires on screen.

### 4. High-Resolution QR Codes for In-Person Events
Clicking the **"Share / QR Code"** button renders an on-canvas QR code:
- Print it on banners, lanyards, or tournament programs.
- Display it on stadium video boards or TVs.
- Fans scan the code to load live standings on their mobile browsers without downloading an app or creating an account.
