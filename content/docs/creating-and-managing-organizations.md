---
slug: "creating-and-managing-organizations"
title: "Creating and Managing Organizations"
description: "A comprehensive guide to creating organization workspaces, managing competitions, discovering public clubs, and configuring team roles."
category: "Participants & Administration"
order: 5
readTime: "5 min read"
lastUpdated: "2026-11-02"
tags: ["organizations", "workspaces", "branding", "roles", "members", "discovery"]
related: ["creator-and-admin-permissions", "understanding-competition-types"]
---

# Creating and Managing Organizations

Organization workspaces in LeaderboardOS allow clubs, schools, leagues, esports clans, and enterprise organizers to group multiple competitions under a unified brand and team administration structure.

---

## What is an Organization?

An organization functions as a centralized workspace. While individual leaderboards track standalone events, an organization provides:

- **Centralized Workspaces**: Group multiple tournaments, leagues, and continuous-points leaderboards in one place.
- **Custom Branding**: Apply custom logos, primary/secondary brand colors, and custom domains across all hosted leaderboards.
- **Collaborative Administration**: Invite co-organizers, managers, and referees with granular role-based access control.
- **Audit Logging**: Track administrative actions, roster changes, and branding modifications across your organization.
- **Public Profile**: Showcase your active public competitions on a dedicated public organization profile page.

---

## My Organizations vs. Discover Organizations

LeaderboardOS maintains a strict separation between private organization administration and public organization discovery:

### 1. My Organizations (`/dashboard/organizations`)
- Accessible only to authorized owners, administrators, and invited team members.
- Displays all organizations you created, own, or belong to.
- Provides administrative controls to edit settings, invite teammates, view audit logs, and associate competitions.
- Distinguishes clearly between loading states, error states, and empty states.

### 2. Discover Organizations (`/directory?tab=organizations`)
- Publicly accessible in the Directory marketplace.
- Displays **only** organizations that host active public competitions or verified custom domains.
- Private organizations, internal workspaces, and organizations with zero public competitions are never listed.
- Visitors can view public organization profiles without exposing private member rosters, audit logs, or administrative controls.

---

## How to Create an Organization

Follow these steps to create your organization workspace:

1. Navigate to the **Console** (`/dashboard`).
2. Click **Organizations** in the header or from the mobile navigation drawer.
3. Click the **Create Organization** button.
4. Fill in the required organization details:
   - **Organization Name**: The public display name (e.g., *Metropolis Gaming League* or *St. Jude High School*).
   - **Workspace Slug**: A unique URL identifier for your workspace (e.g., `metropolis-gaming`).
   - **Description** *(optional)*: A brief summary of your community or enterprise.
   - **Organization Logo** *(optional)*: Upload directly from your device or supply a hosted URL.
5. Click **Create Workspace**. You will be redirected directly to your new organization management hub.

---

## Uploading or Selecting an Organization Logo

When creating an organization or updating branding:

- **Select from Device**: Click **Select logo from device** to choose an image from your phone, tablet, or computer.
- **Supported Formats**: PNG, JPEG, and WebP files up to **2 MB**.
- **Preview & Management**: Once selected, a live preview is shown. You can click **Change** to choose another image or click the **Trash** icon to remove it before saving.
- **Storage**: In live database mode, logos are uploaded securely to Supabase Storage. In offline demo mode, images are preserved in local storage.

---

## Organization Workspace & Associated Competitions

When you open an organization workspace (`/dashboard/organizations/[id]`), you can manage all resources associated with that organization:

### Workspace Sections

1. **Overview**: Key metrics including total managed competitions, custom branding status, custom domain verification, and your personal role.
2. **Competitions**: View all associated leaderboards, league tables, and tournaments with direct links to public scoreboards and administrative control panels.
3. **Members & Roles**: Invite co-organizers, review pending invitations, and update member permissions (`owner`, `admin`, `manager`, `viewer`).
4. **Branding & Domain**: Configure primary, secondary, and accent colors, upload high-resolution logos, and configure white-label custom domains.
5. **Audit Trail**: Inspect a tamper-evident log of changes made to competitions, branding, and team rosters.

### Associating Competitions with an Organization

Competitions can be associated with an organization in two ways:

1. **Creating from the Workspace**: Click **New Competition** from within the organization workspace. The creation wizard automatically carries the organization context (`/dashboard/create?orgId=...`) and saves the competition under your organization.
2. **Associating Existing Competitions**: Click **Associate Competition** inside the workspace. Authorized admins and owners can select from a dropdown of their existing unlinked competitions or enter a competition ID directly.
3. **Unlinking Competitions**: Organization owners and admins can unlink a competition at any time. When unlinked, the competition safely returns to the owner's personal console without losing any scores, participants, or historical results.

---

## Organization Ownership and Roles

When you create an organization, you are assigned the **Owner** role. LeaderboardOS supports four organization roles:

| Role | Permissions & Responsibilities |
| :--- | :--- |
| **Owner** | Full administrative authority. Can manage billing, configure custom domains, invite or remove members, assign roles, and delete the organization. |
| **Admin** | Can create and manage competitions, edit custom branding, invite team members, and view audit history. Cannot transfer ownership or delete the organization. |
| **Manager** | Operational access. Can schedule matches, record scores, and manage participant registrations within organization competitions. |
| **Viewer** | Read-only access to organization dashboards, competitions, and internal reports. |

---

## Troubleshooting Organization Creation & Persistence

If you encounter issues creating or viewing organizations:

- **Authentication Required**: You must be logged into an active account to create or access organizations.
- **Automatic Creator Association**: Creators are permanently recognized as organization owners, even if membership records are pending synchronization.
- **Meaningful Errors**: If a database query fails or authentication expires, a retry error banner is displayed rather than an inaccurate "No organizations found" message.
- **Unique Slug**: Each organization slug must be unique. If a slug is already taken, append a number or suffix.
- **Logo Size Limits**: Ensure uploaded logo files are smaller than 2 MB and in a valid image format (PNG, JPEG, or WebP).
