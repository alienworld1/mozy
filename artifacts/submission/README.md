# Submission readiness

The repository-side release package is fail closed. `pnpm release:check` must not pass until every item below is backed by the current deployment and a real public URL.

## Implemented gates

- [x] Current environment, deployment, market, token, and Attestcoin pins are compared deterministically.
- [x] Historical settlement evidence is rejected when it references the pre-Module-6 deployment.
- [x] Transaction hashes must be full 32-byte values and explorer URLs must derive from configured explorer bases.
- [x] Missing, localhost, non-HTTPS, and placeholder submission URLs fail validation.
- [x] Wrong-token, wrong-party, and replay evidence paths must exist.
- [x] Offline and live checks are reported separately; skipped live evidence is never reported as passed.
- [x] The product omits stale public transaction claims instead of substituting sample evidence.

## External completion required

- [ ] Run a fresh direct TEST delivery and resulting Attestcoin-controlled settlement against `artifacts/protocol/cc3-settlement.json`.
- [ ] Generate `artifacts/protocol/cc3-settlement-evidence.json` through the existing settlement evidence path; do not edit deployment addresses into the historical artifact.
- [ ] Reproduce and record wrong-token, wrong-sender or recipient, and replay rejection against the current release.
- [ ] Deploy the web app and worker, then add the real HTTPS product origin.
- [ ] Export and host the final whitepaper or deck at a public HTTPS URL.
- [ ] Record and host the final product video using the same current reservation and transactions.
- [ ] Complete the browser-assisted accessibility and performance rows in the audit records.
- [ ] Run `pnpm release:check` with live RPC access and record the successful check timestamp in the manifest.

Current status: **not submission-ready**. The missing chain evidence and external URLs are intentional blockers, not passing placeholders.
