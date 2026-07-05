# LeagueBoard 🏆 | Leaderboard-as-a-Service MVP

**LeagueBoard** is a modern, developer-first Leaderboard-as-a-Service (LaaS) platform built with Next.js, Tailwind CSS, and Supabase. It allows gamers, sports leagues, fitness coaches, and corporate managers to create, customize, and manage real-time leaderboards in under 60 seconds without writing code.

---

## 🚀 Key Features

- **Multi-Step Creator Flow**: Bootstrap rankings, add point rules, and config seasons.
- **Audience Presets**: Adapts color schemes, badge formats, and scoring layouts for Gaming (neon/levels), Sports (times/teams), and Workplaces (currency/revenue filters).
- **Interactive Scoring Console**: Easily log scoring events for any player, with immutable activity audits.
- **Podium & Standings Grid**: Display rankings on a high-contrast public page with automatic real-time updates.
- **Smart QR Code Generator**: Renders a sharing QR code on-canvas so participants can join on mobile instantly.
- **Zero-Config Demo Mode**: Runs out of the box using `localStorage` syncing, with automatic integration the moment you add Supabase keys.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4 (Sass-style imports, native CSS custom properties)
- **Icons**: Lucide React
- **Backend / Database**: Supabase (PostgreSQL, Realtime triggers, Storage, Row Level Security)
- **Animations**: Canvas Confetti

---

## 📥 Getting Started

### 1. Clone & Install Dependencies
First, install the packages:
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

If you do not configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the application will automatically fall back to **Demo Sandbox Mode**, storing data locally in the browser and letting you test all features immediately.

---

## 🗄️ Database Setup (Supabase)

To connect LeagueBoard to your live Supabase database, follow these steps:

1. Create a new project in your [Supabase Dashboard](https://supabase.com).
2. Grab the URL and Anon Key from the **Project Settings -> API** tab and paste them in `.env.local`.
3. Open the **SQL Editor** tab in your Supabase Console.
4. Open the `schema.sql` file at the root of this project, copy its contents, paste them into the SQL editor, and click **Run**.
5. Enable **Realtime** on the `score_events` table by executing:
   ```sql
   alter publication supabase_realtime add table score_events;
   ```

---

## 📦 Project Structure

```text
├── schema.sql           # Database schema, triggers, view and RLS policies
├── .env.example         # Template configuration keys
├── src/
│   ├── app/
│   │   ├── layout.tsx   # Base shell wrapping AuthProvider
│   │   ├── page.tsx     # Modern interactive SaaS Landing Page
│   │   ├── login/       # Unified auth portal
│   │   ├── dashboard/   # Creator hub & wizard creation routes
│   │   └── leaderboards/# Public real-time standings view
│   ├── context/
│   │   └── AuthContext.tsx # Handles Supabase auth & local mock fallback
│   ├── lib/
│   │   └── db.ts        # Unified DB access interface (Supabase + Local fallback)
│   └── types/
│       └── index.ts     # TypeScript interfaces
```

---

## ⚖️ RLS & Permissions Model

Only the **Owner** of a leaderboard is authorized to:
- Edit title, description, cover assets, or visibility.
- Register, edit, or delete player members.
- Award or deduct score points.
- Delete or archive the leaderboard.

**Visitors** can only view ranking podiums, search lists, and active logs for leaderboards marked **Public**. **Private** boards require login verification.
