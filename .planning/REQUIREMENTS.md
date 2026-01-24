# Requirements: v1.2 UI/UX Cleanup & Marketing Site

## Overview

Based on comprehensive UI/UX audit identifying 76 validated issues across 7 page categories. Goal: Make IntelliFill "so simplistically creative and intuitive that users become addicted."

## Target Users

| Persona | Pain Points from Audit |
|---------|----------------------|
| Sarah (B2C) | Confused by Company Slug, distracted by marketing on auth pages |
| Ahmed (PRO) | Hidden primary actions, too many nav items, fake search |
| Lisa (HR) | Stats overload, non-functional filters, complex templates flow |

## v1 Requirements (v1.2 Milestone)

### Critical (P0) — Must ship

| ID | Requirement | Audit Finding |
|----|-------------|---------------|
| UX-01 | Remove or implement search bar | Non-functional search bar damages trust |
| UX-02 | Fix or remove View button in FilledFormHistory | Button does nothing when clicked |
| UX-03 | Remove fake status filters | Draft/Completed/Submitted filters don't filter |
| UX-04 | Conditionally show Company Slug field | Only show for multi-tenant/B2B mode |

### High Priority (P1) — Should ship

| ID | Requirement | Audit Finding |
|----|-------------|---------------|
| UX-05 | Remove marketing from auth pages | Move testimonials/marketing to separate site |
| UX-06 | Surface primary actions on cards | "Use Template" should be visible button, not hidden in menu |
| UX-07 | Remove duplicate Quick Actions panel | Dashboard duplicates sidebar nav |
| UX-08 | Consolidate navigation to 5-6 items | Currently 8-10 items causes decision fatigue |
| UX-09 | Rename "Smart Profile" to "My Profile" | "Smart" is jargon, unclear to users |
| UX-10 | Simplify Documents page stats | 6-card stats dashboard dominates page |
| MKT-01 | Create separate marketing site | Auth pages should be clean, marketing belongs elsewhere |
| MKT-02 | Create landing page with hero + CTA | intellifill.com → marketing, app.intellifill.com → app |

### Medium Priority (P2) — Nice to have

| ID | Requirement | Audit Finding |
|----|-------------|---------------|
| UX-11 | Merge Organization tab into Account | Solo users see irrelevant org settings |
| UX-12 | Make stats dashboard collapsible | Power users may want metrics, hide by default |
| UX-13 | Simplify template flow | Remove Preview modal, direct "Use" action |
| UX-14 | Fix mobile navigation | Burger menu requires too many taps |
| UX-15 | Reduce upload page animation | OCR animation distracts from progress |

### Deferred (v2+)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| UX-D1 | Implement real search | Requires backend search infrastructure |
| UX-D2 | Add keyboard shortcuts | Polish item, not blocking |
| UX-D3 | Implement real-time status filters | Requires backend filter support |

## False Positives (Not Requirements)

These audit findings were validated as intentional design:

| Finding | Why Keep |
|---------|----------|
| Confirm Password field | Security standard, reduces typo support tickets |
| Password strength indicator | Helps create secure passwords |
| Marketing opt-in checkbox | GDPR legal requirement |
| Remember me checkbox | Standard auth pattern |
| Theme toggle in sidebar | Low-frequency action, current placement fine |

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Auth page load time | ~2s (carousel) | <500ms |
| Nav items | 8-10 | 5-6 |
| Non-functional UI elements | 4 | 0 |
| Steps to use a template | 3+ (find → preview → use) | 1 (click Use) |
| Marketing/App separation | Mixed | Separate domains |

## Constraints

- Must not break existing flows (parallel update strategy)
- Marketing site must be deployable independently
- Auth page changes must preserve all functionality
- Mobile responsive must be maintained

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 6 | Complete |
| UX-02 | Phase 6 | Complete |
| UX-03 | Phase 6 | Complete |
| UX-04 | Phase 6 | Complete |
| UX-05 | Phase 7 | Pending |
| UX-06 | Phase 6 | Complete |
| UX-07 | Phase 6 | Complete |
| UX-08 | Phase 6 | Complete |
| UX-09 | Phase 6 | Complete |
| UX-10 | Phase 6 | Complete |
| MKT-01 | Phase 7 | Pending |
| MKT-02 | Phase 7 | Pending |
| UX-11 | Phase 8 | Complete |
| UX-12 | Phase 8 | Complete |
| UX-13 | Phase 8 | Complete |
| UX-14 | Phase 8 | Complete |
| UX-15 | Phase 8 | Complete |

**Coverage:**
- v1.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---

_Created: 2026-01-21 from UI/UX audit findings_
