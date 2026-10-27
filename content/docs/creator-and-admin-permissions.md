---
slug: "creator-and-admin-permissions"
title: "Creator and Administrator Permissions"
description: "A breakdown of user roles, delegated matchday referee access, and Row Level Security permissions."
category: "Participants & Administration"
order: 3
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["permissions", "roles", "referees", "security"]
related: ["live-event-day-operations", "team-rosters-and-squads"]
---

# Creator and Administrator Permissions

LeaderboardOS implements Role-Based Access Control (RBAC) backed by PostgreSQL Row Level Security (RLS) to ensure organizers can delegate matchday responsibilities safely.

---

## Permission Roles Matrix

| Role | Who Has It | Key Permissions | Restricted Actions |
| :--- | :--- | :--- | :--- |
| **Competition Owner** | The creator of the competition | Full administrative control: edit rules, manage billing, change visibility, delete competition, manage prize payouts. | None within their competition. |
| **Delegated Admin / Staff** | Invited staff members | Add participants, generate schedules, edit match fixtures, manage sponsor banners. | Cannot delete competition or modify financial payout bank details. |
| **Matchday Referee** | Assigned field operators | Access the live Event-Day Console (`/event-day`), start match clocks, submit match scores and disciplinary cards. | Cannot modify scoring rules, delete teams, or change competition visibility. |
| **Team Captain** | Player designated as squad lead | Manage squad roster, invite teammates, submit match dispute reports. | Cannot edit official competition scores or standings. |
| **Spectator / Viewer** | Public visitors | Read-only access to public leaderboards, standings, and embedded widgets. | No write access. |

---

## Inviting Delegated Administrators or Referees

1. Open your competition in the dashboard and navigate to **"Settings" $\rightarrow$ "Admins & Staff"**.
2. Click **"+ Add Administrator"**.
3. Enter their email address and select their assigned role:
   - **Administrator**: Full management permissions.
   - **Referee**: Limited to live match scorekeeping and attendance check-in.
4. Click **"Send Invite"**. The staff member receives an invite notification granting instant dashboard access.
