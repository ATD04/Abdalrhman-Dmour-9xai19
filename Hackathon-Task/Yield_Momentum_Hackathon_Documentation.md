# Yield Momentum Hackathon Documentation

## Democratizing Micro-Investments for Hourly Workers

**Document Type:** Expanded Hackathon Brief and Solution Planning Documentation  
**Prepared For:** Hackathon participant / solo builder  
**Source Brief:** `hackathon-generator-task.pdf`  
**Challenge Theme:** FinTech, micro-investing, financial inclusion, income volatility, liquidity protection

---

## 1. Executive Summary

The **Yield Momentum Hackathon** is a 24-hour overnight hackathon focused on solving a specific financial access problem: many hourly workers and underbanked individuals are excluded from traditional investment opportunities because they do not have stable income, large savings, or enough financial confidence to commit to standard investment minimums.

The challenge asks participants to build a functional **Minimum Viable Product (MVP)** that helps these users make small, automated, safe investments. The system should analyze daily income, monitor purchase behavior, round up transactions, and move small amounts into accessible investment vehicles such as ETFs, while making sure the user’s short-term liquidity is not harmed.

The strongest solution is not simply a “round-up savings app.” It should be a **liquidity-aware micro-investment engine** that decides when investing is safe, when it should be paused, and how to explain those decisions clearly to the user.

---

## 2. Hackathon Purpose

The purpose of the hackathon is to directly confront an operational and financial friction:

> **Traditional investment systems are not designed for people with volatile hourly wages.**

Hourly workers often experience income uncertainty. Their earnings may change from one week to another depending on shifts, overtime, employer schedules, tips, seasonality, or unexpected missed workdays. Because of this volatility, they may avoid investing completely, even if they want to build wealth over time.

This hackathon focuses on creating a practical tool that allows users to invest in very small amounts without creating financial stress.

### Main target users

The primary users are:

- Hourly workers.
- Gig workers.
- Lower-income earners.
- Underbanked individuals.
- Users with inconsistent wages.
- People who want to start investing but cannot commit to large minimum deposits.

### Core user need

The user needs a system that says:

> “I will help you invest gradually, but I will protect your daily cash flow first.”

---

## 3. Core Challenge Definition

The official challenge can be summarized as follows:

Traditional investment minimums prevent lower-income earners from participating in investment markets. The required solution is an automated engine that analyzes daily income, securely rounds up purchases, and invests small amounts into accessible ETF vehicles without destabilizing the user’s liquidity.

### Key challenge components

| Component | Meaning |
|---|---|
| Daily income analysis | The system should understand how much the user earns and how stable or unstable that income is. |
| Purchase round-ups | The system should round up everyday purchases and collect the difference as a small investable amount. |
| ETF accessibility | The system should simulate or enable investment into simple, diversified ETF options. |
| Liquidity protection | The system must avoid investing if the user may need the money for basic needs. |
| Automation | The user should not need to manually calculate every small investment decision. |
| Security | Financial and personal data must be treated carefully, even in a demo environment. |

---

## 4. Important Terms Explained

### Micro-investing

Micro-investing means investing very small amounts of money over time. Instead of requiring a user to invest $500 or $1,000 at once, the system may invest $0.50, $1.25, or $5.00 depending on what the user can safely afford.

### Round-up investing

Round-up investing means rounding a purchase to the nearest whole amount and saving or investing the difference.

Example:

| Purchase | Rounded Amount | Round-up Difference |
|---:|---:|---:|
| $4.35 | $5.00 | $0.65 |
| $8.10 | $9.00 | $0.90 |
| $2.75 | $3.00 | $0.25 |

The system collects these differences and later moves them into an investment account.

### ETF

An **ETF**, or Exchange-Traded Fund, is a basket of investments that can include stocks, bonds, or other assets. For a beginner user, ETFs are often easier to understand than selecting individual stocks because they can provide diversified exposure.

### Liquidity

Liquidity means how much money the user has available for immediate needs. For hourly workers, liquidity is extremely important because even a small withdrawal at the wrong time can create stress.

### Underbanked

An underbanked person has limited access to traditional financial services. They may have a bank account but still depend on cash, prepaid cards, alternative financial services, or irregular payment systems.

---

## 5. Best Strategic Interpretation of the Challenge

The hackathon is not asking for a generic banking app. It is asking for a focused solution that handles the tension between two goals:

1. Helping users start investing.
2. Protecting users from investing money they may urgently need.

This means the project should be built around a main decision engine:

> **Can this user safely invest today?**

The answer should depend on income, expenses, recent cash flow, upcoming obligations, and a safety buffer.

---

## 6. Recommended MVP Concept

### Suggested product name

**YieldGuard**

### Product tagline

**Micro-investing that protects your cash flow first.**

### One-sentence concept

YieldGuard helps hourly workers automatically invest spare change from everyday purchases into ETF-style portfolios while using a liquidity protection engine to pause investing when cash flow is tight.

---

## 7. Proposed MVP User Flow

The MVP should guide the user through a simple and believable journey.

### Step 1: User onboarding

The user opens the app and sees a short explanation:

- The app helps them invest small amounts.
- Investments are based on round-ups.
- The app pauses automatically when money is tight.
- The demo does not move real money.

### Step 2: Simulated bank connection

The user clicks **Connect Bank Account**.

Since this is a hackathon MVP, the connection can be mocked using a simulated Plaid OAuth flow.

The user sees:

- Bank connected successfully.
- Account balance.
- Recent income deposits.
- Recent purchases.

### Step 3: Income and spending analysis

The system analyzes mock financial data:

- Average daily income.
- Weekly income volatility.
- Essential spending.
- Non-essential spending.
- Current balance.
- Expected near-term expenses.

### Step 4: Liquidity safety check

The system calculates whether investing is safe today.

Possible outputs:

- **Safe to invest**.
- **Invest small amount only**.
- **Pause investing today**.

### Step 5: Round-up calculation

The app calculates the round-up difference from recent purchases.

Example:

| Transaction | Amount | Rounded | Investable Round-up |
|---|---:|---:|---:|
| Grocery store | $23.40 | $24.00 | $0.60 |
| Bus pass | $2.50 | $3.00 | $0.50 |
| Coffee | $4.25 | $5.00 | $0.75 |
| Pharmacy | $11.10 | $12.00 | $0.90 |

### Step 6: Investment recommendation

The system recommends one of the following:

- Invest today’s round-up amount.
- Invest only part of the round-up amount.
- Hold the round-up amount in cash.
- Pause investment until balance improves.

### Step 7: ETF simulation

The user sees a simple simulated portfolio.

Example:

| Portfolio Type | Allocation |
|---|---:|
| Broad Market ETF | 70% |
| Bond ETF | 20% |
| Cash Buffer | 10% |

### Step 8: Explanation screen

The system explains the decision in plain language.

Example:

> “We invested $2.75 today because your current balance is above your safety buffer and your expected essential spending is covered.”

or

> “We paused investing today because your balance is close to your minimum cash safety level.”

---

## 8. Core Feature: Liquidity Protection Engine

The **Liquidity Protection Engine** should be the centerpiece of the MVP.

### Purpose

The engine prevents the app from blindly investing every round-up amount. Instead, it evaluates whether investing is safe based on the user’s current financial situation.

### Inputs

The engine can use the following inputs:

| Input | Description |
|---|---|
| Current balance | How much money the user currently has. |
| Recent income | Income received in the last few days or weeks. |
| Income volatility | How inconsistent the user’s income is. |
| Essential expenses | Rent, food, transport, utilities, medicine, etc. |
| Upcoming obligations | Expected payments due soon. |
| Safety buffer | Minimum cash amount that should remain untouched. |
| Round-up total | The amount collected from purchase round-ups. |

### Simple decision formula

A hackathon-friendly formula can be:

```text
Available Cash = Current Balance - Safety Buffer - Upcoming Essential Expenses
```

Then:

```text
If Available Cash <= 0:
    Pause investing

If Available Cash is low:
    Invest only a small percentage of round-ups

If Available Cash is healthy:
    Invest full round-up amount
```

### Example scenario

| Metric | Value |
|---|---:|
| Current balance | $180 |
| Safety buffer | $100 |
| Upcoming essential expenses | $60 |
| Available cash | $20 |
| Round-up total | $4.80 |

In this case, the system may invest only $1.00 or pause investing, depending on the risk threshold.

---

## 9. Recommended MVP Screens

### Screen 1: Landing / Onboarding

Purpose:

- Explain the product quickly.
- Build trust.
- Show that the system protects liquidity.

Recommended sections:

- Product name and tagline.
- Three-step explanation: Connect, Analyze, Invest Safely.
- CTA button: **Start Demo**.

### Screen 2: Bank Connection Simulation

Purpose:

- Show a believable financial data connection flow.

Recommended sections:

- Simulated Plaid connection button.
- OAuth-style modal.
- Success state.
- Connected account summary.

### Screen 3: Financial Snapshot Dashboard

Purpose:

- Show the user’s financial state.

Recommended cards:

- Current balance.
- Weekly income.
- Income volatility level.
- Essential spending estimate.
- Round-up balance.
- Safe-to-invest score.

### Screen 4: Transactions and Round-ups

Purpose:

- Show how small purchase differences become investable amounts.

Recommended table columns:

- Merchant.
- Category.
- Amount.
- Rounded amount.
- Round-up amount.
- Status.

### Screen 5: Liquidity Decision Explanation

Purpose:

- Make the system transparent.

Recommended content:

- Today’s decision: invest / partial invest / pause.
- Reason for decision.
- Safety buffer status.
- Expected impact on cash flow.

### Screen 6: ETF Portfolio Simulation

Purpose:

- Show where the micro-investments go.

Recommended content:

- Portfolio allocation.
- Total simulated invested amount.
- Risk profile.
- Disclaimer that this is a demo simulation.

### Screen 7: Admin / Technical Declaration Page

Purpose:

- Help judges understand the implementation.

Recommended sections:

- Functional features.
- Mocked features.
- Tech stack.
- Future production architecture.

---

## 10. Suggested Technical Architecture

### Practical 24-hour architecture

For a solo participant, the best practical build is:

```text
Next.js App Router Frontend
        |
        | API Routes / Server Actions
        v
Mock Financial Data Layer
        |
        v
Liquidity Protection Engine
        |
        v
Round-up + ETF Simulation Layer
        |
        v
Dashboard + Technical Declaration
```

### Recommended stack for the MVP

| Layer | Recommended Choice | Reason |
|---|---|---|
| Frontend | Next.js App Router | Fast to build, clean routing, good for web demos. |
| Styling | Tailwind CSS | Fast UI development. |
| Backend | Next.js API routes or lightweight Node backend | Faster than building a separate Go/Rust backend in 24 hours. |
| Data | JSON files, SQLite, or Supabase mock data | Simple and reliable for demo. |
| Bank linking | Mock Plaid flow | Real integration may waste time. |
| Ledger | Mock Stripe ledger | Enough to demonstrate transaction logic. |
| Charts | Recharts or simple dashboard cards | Clear visual storytelling. |
| Deployment | Vercel, Netlify, or local demo | Fast browser-based access. |

### Official suggested stack vs practical hackathon stack

| Area | Official Brief Suggestion | Practical MVP Recommendation |
|---|---|---|
| Frontend | Next.js or Swift | Next.js App Router |
| Backend | Go or Rust | Next.js API routes / Node for speed |
| Bank linking | Plaid API | Mock Plaid flow |
| Ledger | Stripe | Mock ledger layer |
| Security | TLS 1.3, encrypted PII vault, OAuth 2.0 | Simulated security flow with clear explanation |

This approach gives the judges a working product while still respecting the intended architecture.

---

## 11. Functional vs Mocked Declaration

The final submission must clearly identify what works and what is mocked.

### Functional in the MVP

| Feature | Status |
|---|---|
| User onboarding | Functional |
| Demo bank connection flow | Functional UI simulation |
| Mock transaction loading | Functional |
| Round-up calculation | Functional |
| Income/spending analysis | Functional using mock data |
| Liquidity safety decision | Functional rule-based engine |
| Safe-to-invest score | Functional |
| ETF portfolio display | Functional simulation |
| Dashboard UI | Functional |
| Technical declaration page | Functional |

### Mocked in the MVP

| Feature | Mocked Layer |
|---|---|
| Real Plaid bank connection | Simulated OAuth/Plaid flow |
| Real Stripe ledger processing | Simulated ledger entries |
| Real ETF purchase | Portfolio simulation only |
| Real money movement | Not performed |
| Real encrypted PII vault | Security concept described, not production-grade |
| Real identity verification | Not included |

### Suggested technical declaration statement

> This MVP demonstrates the core product logic using simulated financial data. The liquidity protection engine, round-up calculation, investment decision logic, and dashboard experience are functional. Plaid bank linking, Stripe ledger processing, real ETF purchasing, and real money movement are mocked for the purpose of the hackathon demonstration.

---

## 12. Data Model Recommendation

A simple MVP data model can include the following objects.

### User object

```json
{
  "id": "user_001",
  "name": "Alex",
  "workerType": "Hourly Worker",
  "riskProfile": "Conservative",
  "safetyBuffer": 100
}
```

### Account object

```json
{
  "accountId": "acc_001",
  "bankName": "Demo Bank",
  "currentBalance": 245.75,
  "currency": "USD"
}
```

### Transaction object

```json
{
  "transactionId": "txn_001",
  "merchant": "Grocery Market",
  "category": "Essentials",
  "amount": 23.40,
  "roundedAmount": 24.00,
  "roundUpAmount": 0.60,
  "date": "2026-05-20"
}
```

### Investment decision object

```json
{
  "decisionId": "decision_001",
  "date": "2026-05-20",
  "roundUpTotal": 4.80,
  "safeToInvestScore": 82,
  "recommendedInvestment": 4.80,
  "decision": "Invest",
  "reason": "Balance is above safety buffer and essential expenses are covered."
}
```

---

## 13. Safe-to-Invest Score

The **Safe-to-Invest Score** is a useful way to make the app feel intelligent and transparent.

### Score range

| Score | Meaning | System Action |
|---:|---|---|
| 0–39 | High risk | Pause investing |
| 40–69 | Medium risk | Invest partial round-up only |
| 70–100 | Low risk | Invest full round-up amount |

### Possible scoring factors

| Factor | Weight Example |
|---|---:|
| Balance above safety buffer | 35% |
| Income stability | 20% |
| Essential expense coverage | 25% |
| Recent overdraft or low balance risk | 10% |
| Round-up size compared to balance | 10% |

### Example output

```text
Safe-to-Invest Score: 78/100
Decision: Invest full round-up amount
Reason: Current balance is healthy, upcoming essential expenses are covered, and round-up size is small compared to available cash.
```

---

## 14. Security and Trust Considerations

Even if the MVP uses mock data, the final product should show awareness of financial security.

### Security principles to communicate

- Use TLS 1.3 for secure data transfer.
- Store personally identifiable information in encrypted vault storage.
- Use OAuth 2.0 for account connection flows.
- Never expose bank credentials to the application.
- Use tokenized access for bank connections.
- Separate user identity data from transaction analytics where possible.
- Log financial events carefully for auditability.
- Clearly communicate to users when real money movement is happening.

### Trust-focused UX principles

The interface should avoid making the user feel confused or pressured.

Recommended trust features:

- Plain-language explanations.
- Pause investment button.
- Safety buffer setting.
- Transaction-level transparency.
- Clear status labels.
- “Why this decision?” section.
- Demo disclaimer during hackathon.

---

## 15. 24-Hour Execution Plan

### Phase 1: First 2 hours — Concept and scope lock

Goals:

- Finalize product name.
- Define the happy-path demo.
- Decide what is functional vs mocked.
- Create wireframe structure.
- Prepare mock transaction data.

Deliverables:

- Clear MVP scope.
- Basic design direction.
- Data schema draft.

### Phase 2: Hours 3–7 — Core app setup

Goals:

- Create Next.js project.
- Build layout and navigation.
- Add mock data.
- Build dashboard cards.
- Implement transaction table.

Deliverables:

- Working frontend shell.
- Financial snapshot screen.
- Transactions screen.

### Phase 3: Hours 8–12 — Core logic

Goals:

- Implement round-up calculation.
- Implement liquidity protection engine.
- Implement safe-to-invest score.
- Add decision explanation.

Deliverables:

- Functional calculation engine.
- Investment decision output.
- Explanation screen.

### Phase 4: Hours 13–17 — Product polish

Goals:

- Add bank connection simulation.
- Add ETF simulation screen.
- Improve UI consistency.
- Add empty/loading/success states.

Deliverables:

- Complete demo flow.
- Clean UI.
- Clear user story.

### Phase 5: Hours 18–21 — Submission readiness

Goals:

- Write README.md.
- Add technical declaration.
- Prepare 3-minute pitch deck.
- Test happy path.
- Fix critical bugs.

Deliverables:

- Public Git repository.
- README.
- Pitch structure.
- Stable demo.

### Phase 6: Hours 22–24 — Final rehearsal

Goals:

- Practice the live demo.
- Prepare backup screenshots.
- Ensure deployment works.
- Confirm no fatal crashes.

Deliverables:

- Final submission.
- Confident pitch.
- Backup demo plan.

---

## 16. Judging Strategy

The evaluation rubric gives the highest weight to technical execution and problem eradication. Therefore, the project should focus on functionality and problem fit before visual polish.

### Technical Execution — 35%

How to score well:

- Make the app actually work.
- Keep the codebase organized.
- Implement real calculation logic.
- Avoid crashes during demo.
- Use clear component and folder structure.
- Include a detailed README.

### Problem Eradication — 30%

How to score well:

- Show deep understanding of hourly worker income volatility.
- Make liquidity protection the core feature.
- Explain why the system pauses investment.
- Avoid over-investing behavior.
- Design for underbanked users, not wealthy investors.

### Experience Design — 20%

How to score well:

- Use simple language.
- Make the interface accessible.
- Keep actions clear.
- Avoid overwhelming charts.
- Show decision explanations.
- Include trust and safety controls.

### Market Reality — 15%

How to score well:

- Explain a realistic path to production.
- Mention Plaid, Stripe, brokerage integration, and compliance as future layers.
- Explain the revenue model simply.
- Avoid unrealistic claims.
- Show how the system can scale.

---

## 17. Suggested Pitch Narrative

### Opening problem

Hourly workers are often excluded from investing, not because they lack ambition, but because their income is unpredictable and traditional investment products are not designed around their cash flow reality.

### Product solution

YieldGuard allows hourly workers to invest spare change automatically through purchase round-ups, but only when the system determines that investing will not hurt their short-term liquidity.

### Demo story

1. The user connects a simulated bank account.
2. The app analyzes income and spending.
3. The app calculates round-ups from recent purchases.
4. The liquidity engine checks whether investing is safe.
5. The app either invests, partially invests, or pauses.
6. The user sees a clear explanation and a simulated ETF portfolio.

### Technical explanation

The MVP uses a Next.js interface, mock Plaid-style bank linking, mock transaction data, a rule-based liquidity protection engine, round-up calculation logic, and an ETF portfolio simulation. The production version would connect to Plaid, Stripe, and a regulated brokerage partner.

### Closing statement

YieldGuard does not simply automate investing. It makes investing safer and more accessible for people whose income changes every week.

---

## 18. Recommended README Structure

The GitHub README should include:

```markdown
# YieldGuard

## Overview
## Problem Statement
## Solution
## Demo Flow
## Key Features
## Tech Stack
## Architecture
## Functional vs Mocked Features
## How to Run Locally
## Environment Variables
## Data Model
## Future Production Roadmap
## Known Limitations
## Team
```

### Example README overview

> YieldGuard is a hackathon MVP that helps hourly workers participate in micro-investing through purchase round-ups while protecting their short-term liquidity. The app analyzes mock income and transaction data, calculates safe investment amounts, and explains whether investing should proceed, be reduced, or be paused.

---

## 19. Suggested Folder Structure

```text
yieldguard/
├── app/
│   ├── page.tsx
│   ├── dashboard/
│   ├── transactions/
│   ├── portfolio/
│   └── technical-declaration/
├── components/
│   ├── DashboardCard.tsx
│   ├── TransactionTable.tsx
│   ├── SafeToInvestScore.tsx
│   ├── BankConnectionMock.tsx
│   └── PortfolioAllocation.tsx
├── lib/
│   ├── mockData.ts
│   ├── roundups.ts
│   ├── liquidityEngine.ts
│   └── scoring.ts
├── public/
├── README.md
└── package.json
```

---

## 20. Possible Future Production Roadmap

### Phase 1: MVP validation

- Validate user experience with hourly workers.
- Test whether users understand round-up investing.
- Refine liquidity safety rules.

### Phase 2: Real financial integrations

- Add Plaid account linking.
- Add Stripe or ledger partner for transaction processing.
- Add brokerage integration for ETF purchases.

### Phase 3: Personalization

- Let users customize safety buffer.
- Add different risk profiles.
- Add paycheck prediction.
- Add alerts when income changes.

### Phase 4: Compliance and security

- Add identity verification.
- Add encrypted PII storage.
- Add audit logs.
- Add compliance review for investment recommendations.

### Phase 5: Scale

- Support more banks.
- Support employer partnerships.
- Support gig platforms.
- Add multilingual financial education.

---

## 21. Risks and Mitigation

| Risk | Why It Matters | Mitigation |
|---|---|---|
| Over-investing | Users may lose access to needed cash. | Use liquidity safety buffer and pause logic. |
| User confusion | Financial tools can feel intimidating. | Use simple language and explanation cards. |
| False sense of security | The demo may look like real financial advice. | Add clear disclaimers and demo labels. |
| Integration complexity | Real bank/payment APIs may be too much for 24 hours. | Mock integrations and explain production path. |
| Weak demo stability | Crashes can hurt technical score. | Keep happy-path flow simple and test heavily. |

---

## 22. Final Success Criteria

A strong final submission should meet these standards:

- The app runs without fatal crashes.
- The user can complete a full happy-path demo.
- Round-up calculations are visible and correct.
- Liquidity protection logic is functional.
- The investment decision is explained clearly.
- Mocked layers are honestly declared.
- The interface is simple and accessible.
- The README is detailed.
- The 3-minute pitch connects business value, technical architecture, and scalability.

---

## 23. Final Recommendation

The best way to win this hackathon is to make the project feel realistic, responsible, and demonstrable.

Do not build a generic investment app. Build a system that understands the financial reality of hourly workers.

The main message should be:

> **YieldGuard helps hourly workers build investment momentum safely, one small round-up at a time, without sacrificing the cash they need today.**

