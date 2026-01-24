# Phase 8: Polish - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Medium priority UX refinements focused on consolidating settings, making the stats dashboard collapsible, simplifying template flow, fixing mobile navigation, and reducing upload page animation. This phase removes organizational complexity and visual noise from the app.

</domain>

<decisions>
## Implementation Decisions

### Settings consolidation
- Merge Organization tab into Account as sub-tabs structure
- Three sub-tabs: Profile, Organization, Security
- Organization sub-tab visible only to admins/owners (hidden from regular members)
- Default tab is always Profile regardless of role
- Remove top-level Organization nav item completely (no redirect)
- Show badge on Organization sub-tab if setup is incomplete/needs attention
- Security sub-tab contains: password change, session management, 2FA (scaffold)
- Account settings accessible via both nav item AND user avatar dropdown

### Dashboard behavior
- Stats dashboard collapses to a summary row (not fully hidden)
- Summary row shows: documents count • forms filled • profile completeness %
- Single toggle button to collapse/expand

### Template flow simplification
- Remove Preview modal entirely
- Click template → direct to form editor (no intermediate step)
- Template cards show: title + thumbnail preview of form layout
- Templates page has search bar + category filter dropdown
- Add favorites feature: star templates to pin to "Favorites" section at top

### Claude's Discretion
- Dashboard collapse state persistence (localStorage vs session)
- Toggle button placement (right side vs left chevron)
- Thumbnail preview sizing and generation approach
- Mobile navigation fixes (not discussed — handle based on audit findings)
- Upload page animation reduction (not discussed — apply judgment)

</decisions>

<specifics>
## Specific Ideas

- Security tab should be a "full security hub" even if 2FA is scaffolded for later
- Template thumbnails provide visual preview before clicking
- Favorites let power users quick-access frequently used templates

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-polish*
*Context gathered: 2026-01-24*
