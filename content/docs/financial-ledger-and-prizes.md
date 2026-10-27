---
slug: "financial-ledger-and-prizes"
title: "Financial Ledger, Prize Pools, and Refunds"
description: "How to track competition revenue, configure prize pool distributions, and issue verified refunds."
category: "Plans & Billing"
order: 3
readTime: "3 min read"
lastUpdated: "2026-10-27"
tags: ["finance", "ledger", "prizes", "refunds"]
related: ["paid-competition-registrations", "subscription-plans-and-limits"]
---

# Financial Ledger, Prize Pools, and Refunds

Running a tournament often involves collecting entry fees, paying venue rental costs, and disbursing cash prizes to winners. 

The **Competition Financial Ledger** provides an auditable accounting console located at:
`/dashboard/leaderboards/[id]/finance`

---

## 1. The Financial Inflow/Outflow Ledger

Every financial event connected to your competition is automatically logged in the ledger:
- **Registration Inflows**: Real-time credits from confirmed participant Paystack checkouts.
- **Sponsorship Inflows**: Recorded sponsorship revenue and partner contributions.
- **Prize Outflows**: Designated payouts allocated to winning podium finishers.
- **Refund Debits**: Any refunded entry fees.

Each transaction row displays the timestamp, reference ID, payment method, amount, and net competition balance.

---

## 2. Configuring Prize Pool Allocations

1. In the Finance tab, open the **"Prize Pool"** configuration card.
2. Select your allocation model:
   - **Percentage Split**: e.g., 1st Place: 60%, 2nd Place: 30%, 3rd Place: 10%.
   - **Fixed Cash Amounts**: e.g., 1st Place: ₦250,000, 2nd Place: ₦100,000, 3rd Place: ₦50,000.
3. As registration fees accumulate, the projected prize amounts scale automatically.
4. When the tournament finishes, click **"Finalize Prize Allocations"** to generate official payout summaries for winners.

---

## 3. Issuing Refunds

If a registered team withdraws prior to tournament kickoff:
1. Locate their registration record in the Finance console.
2. Click **"Issue Refund"**.
3. Select full or partial refund and enter the mandatory justification note.
4. The system logs a corresponding debit in the ledger and updates their registration status to **Refunded**.
