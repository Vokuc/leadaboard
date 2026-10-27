---
slug: "frequently-asked-questions"
title: "Frequently Asked Questions (FAQ)"
description: "Answers to common questions regarding LeaderboardOS features, limits, data privacy, and integrations."
category: "Troubleshooting & FAQ"
order: 3
readTime: "4 min read"
lastUpdated: "2026-10-27"
tags: ["faq", "common-questions", "answers", "help"]
related: ["what-is-leaderboardos", "subscription-plans-and-limits"]
---

# Frequently Asked Questions (FAQ)

Find answers to common questions about LeaderboardOS features, pricing, scoring rules, and integrations.

---

### Can I run a competition without signing up or connecting a database?
**Yes!** LeaderboardOS includes a built-in **Demo Sandbox Mode**. You can launch the application locally or test the public demo instance directly in your browser. All creation, scheduling, and scoring features work out of the box using local browser storage.

---

### Do spectators need to create an account to view leaderboards?
**No.** Public leaderboards (`/leaderboards/[slug]`) and embedded widgets (`/embed/[slug]`) are completely open. Spectators can follow live standings, search for players, and scan venue QR codes on mobile without ever creating an account or logging in.

---

### How do I collect registration fees from participants?
If you have a **Pro** or **Business** account, you can enable **Paid Registration** in your competition settings. Competitors pay their entry fee securely via our **Paystack** checkout integration using debit cards, bank transfers, or mobile money before being enrolled.

---

### Can I connect a league to a tournament playoff?
**Yes.** Our **Multi-Stage Pathways** engine allows you to link a completed round-robin league table directly to a knockout playoff bracket. When the league ends, top qualifiers automatically seed into the tournament bracket.

---

### Can I embed a live leaderboard on my WordPress, Wix, or custom website?
**Yes.** Every public competition supports a responsive `<iframe>` embed. You can customize the theme (`dark`, `light`, or `neon`) and toggle the top-3 podium showcase using URL parameters.

---

### How are ties broken in league tables?
LeaderboardOS applies a configurable tie-breaker cascade: Goal Difference (`GD`), Goals For (`GF`), and Head-to-Head results between tied clubs. You can re-order or adjust these tie-breakers at any time from your league rules settings.

---

### Where can I get developer API keys for custom automated scoring?
API keys are available for Pro and Business plan subscribers in the **Developer Portal** at `/dashboard/developer`. You can generate scoped keys to submit score events, query standings, and receive real-time match webhooks.
