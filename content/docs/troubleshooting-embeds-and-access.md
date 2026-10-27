---
slug: "troubleshooting-embeds-and-access"
title: "Troubleshooting Embeds, Sign-In, and Permissions"
description: "How to fix iframe scrollbars, magic link delivery issues, permission errors, and demo mode questions."
category: "Troubleshooting & FAQ"
order: 2
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["troubleshooting", "embeds", "auth", "permissions"]
related: ["troubleshooting-standings-and-matches", "embedding-competitions"]
---

# Troubleshooting Embeds, Sign-In, and Permissions

This guide covers common integration, authentication, and permission issues encountered by organizers and site administrators.

---

## Issue 1: Embedded leaderboard has scrollbars or content gets cut off

### Likely Causes:
- The host page's container height is smaller than the embedded leaderboard's content.

### Safe Fix:
1. In your `<iframe>` code, set `height="750"` or higher (e.g. `min-height: 700px; width: 100%;`).
2. Add `scrolling="no"` or style the container with `overflow: hidden;`.
3. If embedding on a mobile layout, append `?podium=false` to the embed URL to hide the top podium showcase and render a compact tabular view.

---

## Issue 2: Did not receive Email Magic Link for Sign-In

### Likely Causes:
- Email typo or strict corporate spam filter.

### Safe Fix:
1. Check your Spam, Junk, or Promotions folder for an email from LeaderboardOS.
2. If using a corporate email with strict firewalls, try signing in with **Google OAuth** instead.
3. If testing locally in development, look at the green **"Demo Sandbox"** mode, which lets you log in instantly without email delivery.

---

## Issue 3: "Access Denied / Insufficient Permissions" in Dashboard

### Likely Causes:
- You are logged in with an account that is neither the owner nor an authorized administrator of that specific competition.

### Safe Fix:
1. Verify the active email in the top right profile menu.
2. Ask the competition owner to navigate to **"Settings" $\rightarrow$ "Admins & Staff"** and ensure your email is added as an **Administrator** or **Referee**.
