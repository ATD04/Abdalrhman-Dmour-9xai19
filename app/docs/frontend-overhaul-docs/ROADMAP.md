# SHAHM Frontend Overhaul — Roadmap

> Living document tracking the UI/UX revolution of the SHAHM platform.
> Updated as each phase is completed.

---

## Phase Overview

| Phase | Focus | Status | Sprint Estimate |
|-------|-------|--------|-----------------|
| Phase 1 | Auth/Route Protection + Chat Decomposition | Pending | 2 sprints |
| Phase 2 | Design System Unification + Missing Components (Table, Toast, Dialog) | Pending | 1-2 sprints |
| Phase 3 | React Query Adoption + i18n Migration | Pending | 2 sprints |
| Phase 4 | Responsive/Mobile + Accessibility Audit | Pending | 1-2 sprints |
| **Phase 5** | **UX Quick Wins + Onboarding + Polish + UI/Color Revamp** | **Done** | 1 sprint |

---

## Phase 1 — Auth/Route Protection + Chat Decomposition

### Goals
- Add Next.js middleware for route-level role gating
- Move auth to HTTP-only cookies or JWT (eliminate localStorage-only auth)
- Create `<ProtectedRoute>` wrapper component
- Replace all `window.confirm()` with branded `ConfirmationDialog`
- Add session expiry
- Decompose `page.tsx` (1,496 lines) into focused components:
  - `ChatProvider`, `ChatMessageList`, `ChatInputBar`, `ChatMessage`
  - `ChatLoadingPipeline`, `SourceViewerPanel`, `EscalationPrompt`, `SuggestedPrompts`

### Edge Cases
- User role changes while logged in
- Multiple tabs with different roles
- Token expiry during long SSE stream
- Deep-link sharing across roles
- SSE reconnection on connection drop
- 100+ message conversations (need virtualization)
- Concurrent tab localStorage race conditions

### Completion Criteria
- No unprotected admin/executive routes
- Chat page under 300 lines with composable sub-components
- All destructive actions use branded confirmation dialog

---

## Phase 2 — Design System Unification + Missing Components

### Goals
- Migrate Login/Signup from `<style jsx global>` to shared design system
- Split `globals.css` (2,242 lines) into: `tokens.css`, `base.css`, `utilities.css`
- Kill component-level CSS classes — move to Tailwind
- Fix mono theme (replace `!important` overrides with proper token layers)
- Build missing shared components:
  - `DataTable` (sortable, filterable)
  - `Toast/Notification` system
  - `ConfirmationDialog`
  - `Tabs` (wrapper around Radix)
  - `FileUpload` (drag-drop with queue)
  - `DatePicker`
  - `Dropdown`

### Edge Cases
- Theme transition flicker on page load
- Long Arabic text in fixed-width table columns
- Toast stacking (multiple simultaneous notifications)
- File upload with 10+ files queued

### Completion Criteria
- Zero `<style jsx>` in the codebase
- `globals.css` under 500 lines
- All inline table/dialog/toast implementations replaced with shared components

---

## Phase 3 — React Query Adoption + i18n Migration

### Goals
- Adopt TanStack Query for all server state (caching, deduplication, retry)
- Slim down AppContext to role/theme/lang only
- Add BroadcastChannel for cross-tab state sync
- Adopt `next-intl` for internationalization
- Extract all inline strings to `messages/ar.json` and `messages/en.json`
- Proper Arabic number/date formatting

### Edge Cases
- Offline/poor connectivity (government building WiFi)
- Stale cache after document upload
- Mixed-language content (Arabic doc titles in English UI)
- Arabic-Indic vs Western Arabic digits
- Long Arabic text overflowing containers (~30% wider than English)

### Completion Criteria
- Zero raw `fetch()` + `useState` data fetching patterns
- Zero inline `isAr ? "..." : "..."` conditionals
- Cross-tab data synchronization working

---

## Phase 4 — Responsive/Mobile + Accessibility Audit

### Goals
- Mobile sidebar (hamburger drawer or bottom sheet)
- Mobile source viewer (full-screen overlay)
- Mobile tables (card view transformation)
- Touch target sizing (minimum 44x44px)
- PWA configuration
- Skip-to-content link
- `aria-live` for streaming chat responses
- `role="log"` on message container
- WCAG AA color contrast audit
- Status icons alongside color for colorblind support
- Roving tabindex for navigation

### Edge Cases
- Orientation change mid-chat on tablet
- Long Arabic ministry names in mobile cards
- PDF page viewer pinch-to-zoom
- Keyboard pushing chat input off screen on mobile

### Completion Criteria
- Usable on 375px viewport
- WCAG 2.1 AA compliant
- Lighthouse accessibility score > 90

---

## Phase 5 — UX Quick Wins + Onboarding + Polish + UI/Color Revamp

### Goals
- Role-contextual empty chat states
- Streaming progress indicator (top bar)
- Toast notification system with undo
- Batch file upload with drag-and-drop queue
- Knowledge search: recent searches, suggestions, filter presets
- Ticket status timeline visualization
- Session timeout with warning + extend option
- Contextual error recovery with retry buttons
- First-time user onboarding tour
- Color palette audit and enhancement
- UI polish pass across all pages

### Completion Criteria
- Consistent feedback patterns (toast for all user actions)
- Onboarding flow for new users
- Refined color palette with proper contrast ratios
- Polished micro-interactions across all pages

---

## Completed Phases

### Phase 5 — Completed

**Scope**: Full color palette audit, design token migration, UI component library overhaul, page-level standardization, and new UX patterns.

#### What was done

**1. Color Palette & Token Alignment**
- Resolved dual color system conflict: Tailwind config defined sky-blue primary (`#0ea5e9`) while CSS vars defined neutral black primary — aligned Tailwind config to match CSS vars
- Added missing semantic token stops to `globals.css`: `--success-700`, `--warning-700`, `--error-700`, `--info-700`, `--teal-accent`, `--teal-light`
- Added semantic color scales to `tailwind.config.ts`: success, warning, error, info (50/100/500/700 stops), teal alias, surface colors referencing CSS vars

**2. UI Component Library Overhaul** (`src/components/ui/`)
- **base.tsx**: Button migrated from `var(--navy-royal)` to `var(--primary-700)`, danger uses error tokens, inputs use `var(--bg-card)` and `var(--text-muted)`, broken `text-navy-royal` Tailwind classes replaced with inline styles
- **data-display.tsx**: StatCard, ConfidenceBadge, StatusBadge, SourceCard — all hardcoded hex replaced with CSS var tokens, semi-transparent backgrounds use `color-mix(in srgb, ...)`
- **feedback.tsx**: Alert variants use CSS vars, LoadingSpinner uses `var(--primary-700)`, ModulePlaceholder uses `color-mix()` for gold accents
- **containers.tsx**: Card uses `var(--bg-card)` and `var(--border-light)`, PageHeader and Breadcrumb use `var(--primary-700)`
- **service.tsx**: Health indicator fully tokenized (success/error/warning tokens)

**3. New Components**
- **Toast notification system** (`toast.tsx`): Context-based provider, 4 variants (success/error/warning/info), auto-dismiss with configurable duration, max 5 visible, action buttons, `aria-live="polite"` accessibility, AnimatePresence animations
- Integrated `<ToastProvider>` into `layout.tsx`

**4. AppShell Fixes** (`AppShell.tsx`)
- Fixed avatar gradient bug: ROLE_META used white for gradient creating invisible white-on-white avatar — added `avatarGradient` field with proper per-role gradients
- Fixed invisible sidebar border: `border-white/[0.06]` → `var(--border-light)`
- Migrated ~15 hardcoded Tailwind gray classes to design tokens throughout sidebar and topbar
- Fixed outer wrapper background: `bg-gray-50/50` → `var(--bg-subtle)`

**5. Page-Level Standardization**
- **admin/page.tsx**: Error banner → Alert component, StatCard iconColors → CSS vars, added skeleton loading, empty audit → EmptyState
- **executive/page.tsx**: Error banner → Alert, Recharts colors → CSS vars, hero rgba → `color-mix()`, SectorDetailModal → design tokens
- **expert/page.tsx**: Error banner → Alert, delete button rgba → `color-mix()`, empty activity → EmptyState
- **my-tickets/page.tsx**: Custom stat cards → StatCard components, custom empty → EmptyState, raw inputs → Input/Select, removed debug code, unified mixed emerald/green → `var(--success-*)`
- **saved/page.tsx**: All slate colors → design tokens, amber → `var(--accent-gold)`, delete → error tokens
- **landing/page.tsx**: All hardcoded hex → CSS custom properties, removed hardcoded font-family, rgba → `color-mix()`
- **page.tsx** (chat): Added role-contextual welcome titles (citizen/operator/admin with Arabic translations), replaced 13+ hardcoded hex colors with CSS variable tokens

#### Known remaining items (deferred to future phases)
- `globals.css` is still 2,243 lines (split into `tokens.css`/`base.css`/`utilities.css` is Phase 2 work)
- Dark/mono themes use `!important` overrides (Phase 2)
- Remaining pages not yet standardized: `knowledge/upload`, `admin/settings`, `admin/users`, `expert/tickets`, `expert/history`, `executive/analytics`, `executive/ministries`
- Advanced UX features deferred: session timeout warning, batch file upload UX, knowledge search presets, ticket timeline visualization, first-time onboarding tour, contextual error recovery with retry buttons
