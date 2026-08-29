# Accessibility and responsive audit

Audit date: 2026-08-29. Required profiles are 375×812 mobile, 768×1024 tablet, and 1440×900 desktop. Browser-assisted rows remain open until run against the production build; source review is complete and no unresolved source-level blocker is known.

| Route | Viewports | Input modes | States to verify | Source-review result | Browser result |
| --- | --- | --- | --- | --- | --- |
| `/` | mobile, tablet, desktop | keyboard, touch, pointer | default, reduced motion, current evidence unavailable | Skip target and semantic mobile flow present; stale evidence is omitted | Pending |
| `/markets` | mobile, tablet, desktop | keyboard, touch, pointer | loading, empty, degraded, default | Labeled schedule rows and stable loading surface present | Pending |
| `/markets/[mandateId]` | mobile, tablet, desktop | keyboard, touch, pointer | malformed, missing, changed, default | Object-specific not-found and structured instrument facts present | Pending |
| `/acquisitions` | mobile, tablet, desktop | keyboard, touch, pointer | disconnected, loading, empty, degraded, default | Wallet-scoped state and labeled rows present | Pending |
| `/acquisitions/new` | mobile, tablet, desktop | keyboard, touch, pointer | invalid, disconnected, wrong network, pending, rejected | Persistent labels and associated errors present | Pending |
| `/acquisitions/[mandateId]` | mobile, tablet, desktop | keyboard, touch, pointer | malformed, missing, loading, lifecycle actions, dialogs | Dialog containment, focus trap, and restoration reviewed | Pending |
| `/solver` | mobile, tablet, desktop | keyboard, touch, pointer | disconnected, loading, empty, degraded, active/history | Labeled reservation rows and explicit next actions present | Pending |
| `/solver/reservations/[reservationId]` | mobile, tablet, desktop | keyboard, touch, pointer | malformed, missing, candidate rejected, proof delay, expiry, settled | Exact delivery terms, recovery, and status sequence persist without hover | Pending |
| `/activity` | mobile, tablet, desktop | keyboard, touch, pointer | loading, empty, degraded, default | Labeled chronological rows and stable skeleton present | Pending |
| `/activity/receipts/[reservationId]` | mobile, tablet, desktop | keyboard, touch, pointer | malformed, missing, waiting, settled | Relationship order, long-value copy, and explorer actions present | Pending |
| `/how-mozy-works` | mobile, tablet, desktop | keyboard, touch, pointer | default, reduced motion | Native disclosures and structural reading order present | Pending |
| `/test-funds` | mobile, tablet, desktop | keyboard, touch, pointer | disconnected, loading, read failure, rejected, ready | Testnet-only copy and explicit readiness states present | Pending |
| unknown route | mobile, tablet, desktop | keyboard, touch, pointer | not found | Framework-native 404 links back to Markets | Pending |
| fatal/segment error | mobile, tablet, desktop | keyboard | error, retry | Next.js 16 `error`/`reset` contracts and valid global document structure present | Pending |

## Browser completion procedure

For each row, confirm no page-level horizontal overflow, a visible focus indicator, 44px practical targets, meaningful state without color, full keyboard operation, and no critical/serious automated accessibility diagnostic. At 200% zoom, repeat navigation, the acquisition form, one reservation, and one receipt. Open both dialogs near the bottom of a mobile viewport, tab through them, close with Escape where enabled, and confirm focus returns to the opener.

Issues found during source review and resolved:

- Error-boundary retry props used `retry` instead of the Next.js 16 `reset` contract.
- The global unknown-route surface was absent.
- Candidate replacement did not restore opener focus after dismissal.
- Dialog bodies could exceed the dynamic mobile viewport.
- The receipt relationship duplicated the same three stages for assistive technology.
- Route changes did not move focus to the new main workspace.
- User-facing test-fund copy used internal “demo” language.
- The landing page published evidence from a superseded deployment.
