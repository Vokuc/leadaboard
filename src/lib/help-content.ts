// Centralized "how to use" help content shown via the HelpModal component
// across the app. Keeping this in one place makes it easy to keep the
// guidance in sync as features change.

export interface HelpSection {
  heading: string;
  items: string[];
}

export const dashboardHelp = {
  title: 'How the Console Works',
  description: 'This is your control center for every leaderboard you own.',
  sections: [
    {
      heading: 'Competition Types',
      items: [
        'Gaming / Esports — track match wins, MVPs, kill streaks.',
        'Sports Tournament — track wins, draws, losses.',
        'Fitness / Health Run — track workouts, streaks, personal records.',
        'Workplace SDRs / Sales — track deals closed, meetings booked, upsells.',
        'Reading Marathon — track books and chapters finished.',
        'Education / Classroom — track test scores and homework.',
        'Custom Tracker — define your own point events from scratch.'
      ]
    },
    {
      heading: 'What you can do here',
      items: [
        'Create Leaderboard — start the setup wizard for a new competition.',
        'Search — filter your boards by name or description.',
        'Active / Archived tabs — switch between live boards and archived ones.',
        'The ⋮ menu on a card lets you Duplicate, Archive/Restore, or permanently Delete a board.',
        'Click any board card to open its management console (players, scores, settings).'
      ]
    }
  ] as HelpSection[]
};

export const createLeaderboardHelp = {
  title: 'How to Build a Leaderboard',
  description: 'A 3-step wizard sets up your competition, its scoring rules, and an optional season.',
  sections: [
    {
      heading: 'Step 1 — Identity',
      items: [
        'Name and describe your competition.',
        'Pick a Competition Type — this auto-suggests a matching cover image and scoring presets.',
        'Choose Public (anyone with the link can view) or Private visibility.'
      ]
    },
    {
      heading: 'Step 2 — Scoring Rules',
      items: [
        'Rules define how members earn (or lose) points, e.g. "Win Match = +30".',
        'Use "Apply Preset" to auto-load recommended rules for your chosen competition type.',
        'Or add your own: give the event a name, a point value (use negative numbers for penalties), and an optional description.',
        'You can add, edit selection, or remove rules before finishing — rules can also be adjusted later from the leaderboard\'s Scores tab.'
      ]
    },
    {
      heading: 'Step 3 — Season',
      items: [
        'Optionally scope the competition to a season with a start and end date.',
        'Leave season off for an indefinite, always-running leaderboard.'
      ]
    }
  ] as HelpSection[]
};

export const leaderboardManagementHelp = {
  title: 'How to Manage This Leaderboard',
  description: 'Use the tabs below to run your competition end-to-end.',
  sections: [
    {
      heading: 'Overview Tab',
      items: [
        'Share the public link or QR code so players and viewers can follow live rankings.',
        'See recent activity logs at a glance.'
      ]
    },
    {
      heading: 'Players Tab',
      items: [
        'Add players/members with a name, optional email, team, notes, and avatar.',
        'Search and edit existing players, or deactivate ones no longer competing.'
      ]
    },
    {
      heading: 'Scores Tab & Rules',
      items: [
        'Pick a member, then pick a scoring rule (or "Custom") to award points automatically at that rule\'s value.',
        'Custom entries let you set any point amount with a required reason — useful for one-off bonuses or penalties.',
        'Every adjustment is recorded to the activity log and instantly updates the public rankings.'
      ]
    },
    {
      heading: 'Settings Tab',
      items: [
        'Update the name, description, cover image, and public/private visibility at any time.',
        'Changes apply immediately to the public leaderboard page.'
      ]
    }
  ] as HelpSection[]
};

export const publicLeaderboardHelp = {
  title: 'How to Read This Leaderboard',
  description: 'This page updates live as the leaderboard owner logs new scores.',
  sections: [
    {
      heading: 'Finding players',
      items: [
        'Use Search to find a player by name.',
        'Use the Team filter to narrow to a specific team.',
        'Use the Rank filter to jump to Top 10 or Top 50 only.'
      ]
    },
    {
      heading: 'Player details & sharing',
      items: [
        'Click any player row to view their full scoring history.',
        'Use the Share button to copy the link or show a QR code for others to follow along.',
        'Rankings and activity refresh automatically in real time — no need to reload the page.'
      ]
    }
  ] as HelpSection[]
};

export const loginHelp = {
  title: 'How Sign-In Works',
  description: 'LeagueBoard uses secure, passwordless authentication — no passwords to remember.',
  sections: [
    {
      heading: 'Email sign-in',
      items: [
        'Enter your email and click Sign Up (new account) or Log In (existing account).',
        'We send a magic link/one-time code to your inbox — click it to finish signing in.',
        'No password is ever created or required.'
      ]
    },
    {
      heading: 'Google sign-in',
      items: [
        'Click "Continue with Google" to sign in instantly using your Google account.'
      ]
    },
    {
      heading: 'Demo Sandbox Mode',
      items: [
        'If the app isn\'t connected to a live database yet, it runs in a local demo mode using sample data stored only in your browser.'
      ]
    }
  ] as HelpSection[]
};
