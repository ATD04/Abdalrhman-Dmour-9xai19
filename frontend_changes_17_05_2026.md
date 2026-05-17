# Frontend Changes — 17 May 2026

## Overview

On this date, a focused round of frontend improvements was made to the **360 CitizenVoices** dashboard. All changes were purely visual and structural — no backend logic, API contracts, data models, or application behavior were modified. The goal was to improve usability, reduce visual noise, and bring the interface into closer alignment with the project's dark, premium, government-grade design language.

---

## 1. Simplification of the "New Action" Form

**File:** `frontend/src/modules/actions.jsx`

The `CreateActionDrawer` component, which opens when a user clicks the "إجراء جديد" (New Action) button, previously contained a large and complex form with many fields: title, recommended action, linked insight, owner, due date, priority, target KPI, CXI component, and escalation rule.

The form was restructured to contain only two fields:

- **العنوان (Title)** — a single-line text input that auto-focuses when the drawer opens and supports submitting by pressing Enter.
- **الإجراء الموصى به (Recommended Action)** — a resizable textarea for describing the recommended steps.

All removed fields (owner, due date, priority, KPI, CXI component, linked insight, escalation rule) are still written to the action object with sensible default values, so no existing data structures or downstream logic were broken. The submit button was made full-width in the drawer footer and is visually disabled until a title is entered.

---

## 2. Redesign of the Page Footer

**File:** `frontend/src/app.jsx`

The "مُشغَّل من قِبَل 9XAI Team" (Powered by 9XAI Team) label at the bottom of every page was previously a plain centered text line that visually floated in the middle of the screen with no grounding.

It was replaced with a more refined layout: two thin horizontal rule lines flank the label on both sides, creating a classic "rule with centered text" typographic pattern. The entire element is rendered at 45% opacity so it reads as a quiet watermark rather than an active UI element. The top margin was increased to push it further below the page content, giving each module more breathing room before the footer appears.

---

## 3. Refinement of the Drawer Backdrop Overlay

**File:** `frontend/src/tokens.css`

The semi-transparent backdrop that appears behind the side drawer when it opens was adjusted for better visual harmony with the dashboard. The original overlay color was a mid-opacity dark blue that looked washed-out or grayish on lighter page backgrounds.

After several iterations, the final backdrop was set to `rgba(10, 20, 38, 0.32)` with a `blur(1px)` filter. This provides a subtle dark veil that signals focus and depth without overpowering or whitening the dashboard content behind it. The blur is intentionally kept minimal so the background remains recognizable rather than faded.

The drawer panel itself was reverted to use `var(--surface)` (the standard page surface color) with a softer drop shadow, keeping it consistent with the rest of the light-mode UI while the backdrop provides the necessary contrast separation.

---

## Summary of Files Modified

| File | Change |
|---|---|
| `frontend/src/modules/actions.jsx` | Simplified `CreateActionDrawer` to two fields only |
| `frontend/src/app.jsx` | Redesigned the page footer label |
| `frontend/src/tokens.css` | Tuned drawer backdrop color and drawer panel shadow |
