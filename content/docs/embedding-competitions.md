---
slug: "embedding-competitions"
title: "Embedding Competitions on External Websites"
description: "How to embed responsive leaderboards, league tables, and tournament brackets into WordPress, Wix, Webflow, or custom sites."
category: "Sharing & Embeds"
order: 2
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["embed", "iframe", "widgets", "customization"]
related: ["public-competition-pages-and-qr-codes", "publishing-and-sharing"]
---

# Embedding Competitions on External Websites

You can embed any public LeaderboardOS competition directly into your own website, blog, or community portal using a responsive HTML `<iframe>`.

---

## Basic Embed Code

Copy and paste the following snippet into your HTML page or website builder:

```html
<iframe
  src="https://leaderboardos.com/embed/[your-slug]?theme=dark&podium=true"
  width="100%"
  height="750"
  frameborder="0"
  allowtransparency="true"
  loading="lazy"
></iframe>
```

---

## Supported URL Customization Parameters

Customize the embed appearance by appending query parameters to the embed URL:

| Parameter | Supported Values | Default | What It Controls |
| :--- | :--- | :--- | :--- |
| `theme` | `dark`, `light`, `neon` | `dark` | Adapts the background, text, and border contrast. |
| `podium` | `true`, `false` | `true` | Toggles the top-3 podium showcase on/off. Set to `false` for a compact table. |
| `header` | `true`, `false` | `false` | Shows or hides the top LeaderboardOS branding bar. |
| `round` | Integer (e.g. `1`, `2`) | Active | Locks a league view to a specific matchday round. |

### Example with Compact Settings:
```text
https://leaderboardos.com/embed/premier-league-2026?theme=light&podium=false
```

---

## Responsive Sizing Best Practices

- **Recommended Height**: We recommend setting `height="750"` or `min-height: 700px` to prevent vertical scrollbars on desktop displays.
- **Full Width**: Set `width="100%"` so the leaderboard dynamically adapts to mobile screens, tablet columns, or desktop sidebars.
- **HTTPS Required**: Your host website must serve over HTTPS to embed LeaderboardOS iframe widgets securely.
