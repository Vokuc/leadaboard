---
slug: "configuring-competition-settings"
title: "Configuring Competition Settings"
description: "How to manage competition title, slug, public visibility, audience themes, and season dates."
category: "Getting Started"
order: 4
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["settings", "slug", "visibility", "branding"]
related: ["creating-your-first-competition", "publishing-and-sharing"]
---

# Configuring Competition Settings

Once a competition is created, you can fine-tune its identity, access controls, and visual presentation at any time from the **Settings** tab.

---

## Accessing Competition Settings

1. Open your competition in the dashboard at `/dashboard/leaderboards/[id]`.
2. Click on the **"Settings"** tab in the competition navigation bar.

---

## General Settings

### Title and Description
- **Competition Title**: Can be updated at any time (e.g., adding sponsor names or season tags).
- **Description**: Supports markdown formatting to display official tournament rules, registration deadlines, and sponsor notices.

### Public URL Slug
- Your URL slug defines your public address: `/leaderboards/[slug]`.
- **Note**: You can change your slug as long as no official match results have been recorded. Once scores are submitted, slug renaming is restricted to prevent breaking spectator links, embed widgets, and physical QR codes.

### Visibility (Public vs. Private)
- **Public**: Your event is visible on `/directory`, searchable by visitors, and accessible without logging in.
- **Private**: Hidden from the directory. Only people with the direct URL or designated administrators can access it.

---

## Audience Themes & Visual Presets

LeaderboardOS automatically adapts badge formats, accent colors, and scoring terms based on your chosen audience preset:
- **Gaming Preset**: Dark background with vibrant neon highlights, level/XP badges, and gamer handles.
- **Sports Preset**: Clean high-contrast tables, club crests, match round numbers, and goal differentials.
- **Workplace Preset**: Modern corporate styling with currency indicators, meeting milestones, and department filters.

---

## Season Boundaries

You can optionally define an active **Season Window** with a start date and an end date. 
- During an active season, score submissions are enabled.
- When the season end date passes, the leaderboard enters an archived, read-only state that preserves the final standings for historical record.
