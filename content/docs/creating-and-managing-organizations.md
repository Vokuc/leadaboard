---
slug: "creating-and-managing-organizations"
title: "Creating and Managing Organizations"
description: "A comprehensive guide to creating organization workspaces, uploading brand logos, managing team roles, and grouping competitions."
category: "Participants & Administration"
order: 5
readTime: "4 min read"
lastUpdated: "2026-10-28"
tags: ["organizations", "workspaces", "branding", "roles", "members"]
related: ["creator-and-admin-permissions", "understanding-competition-types"]
---

# Creating and Managing Organizations

Organization workspaces in LeaderboardOS allow clubs, schools, leagues, esports clans, and enterprise organizers to group multiple competitions under a unified brand and team administration structure.

---

## What is an Organization?

An organization is a multi-competition workspace. While individual leaderboards track standalone events, an organization provides:

- **Centralized Workspaces**: Group multiple tournaments, leagues, and continuous-points leaderboards in one place.
- **Custom Branding**: Apply custom logos, primary/secondary brand colors, and custom domains across all hosted leaderboards.
- **Collaborative Administration**: Invite co-organizers, managers, and referees with granular role-based access control.
- **Audit Logging**: Track administrative actions, roster changes, and branding modifications across your organization.

---

## How to Create an Organization

Follow these steps to create your organization workspace:

1. Navigate to the **Console** (`/dashboard`).
2. Click **Organizations** in the header or from the mobile menu drawer.
3. Click the **Create Organization** button.
4. Fill in the required organization details:
   - **Organization Name**: The public display name (e.g., *Metropolis Gaming League* or *St. Jude High School*).
   - **Workspace Slug**: A unique URL identifier for your workspace (e.g., `/org/metropolis-gaming`).
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

## Navigating Between Organizations

You can belong to multiple organizations simultaneously:

- Access your workspaces directory at `/dashboard/organizations`.
- Each organization card displays its name, workspace slug, assigned role (`owner`, `admin`, `manager`, `viewer`), competition count, and member count.
- Click **Open Workspace** to enter the dedicated organization management hub for any workspace you belong to.

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

## Managing Team Members

To collaborate with staff and co-organizers:

1. Open your organization workspace from `/dashboard/organizations`.
2. Click the **Team Members** tab or navigate to `/dashboard/organizations/[id]/members`.
3. Click **Invite Member** and provide their email address and assigned role.
4. Existing members can have their roles updated or be removed at any time by organization owners and admins.

---

## Troubleshooting Organization Creation

If you encounter issues creating an organization, verify the following:

- **Authentication Required**: You must be logged into an active account to create an organization. If an *Unauthorized* message appears, log out and sign back in to refresh your authentication session.
- **Unique Slug**: Each organization slug must be unique. If a slug is already taken by another organization, adjust the slug field to a unique string.
- **Logo Size Limits**: Ensure uploaded logo files are smaller than 2 MB and in a valid image format (PNG, JPEG, or WebP).
- **Required Fields**: Both **Organization Name** and **Workspace Slug** are required.

---

## Where to Find Organization Settings

All organization settings can be accessed from the organization workspace view:

- **Branding & Theme**: Customize colors, custom logos, and custom domains under `/dashboard/organizations/[id]/branding`.
- **Members & Roles**: Manage staff access under `/dashboard/organizations/[id]/members`.
- **Audit History**: Review administrative logs and security events under `/dashboard/organizations/[id]/audit`.
