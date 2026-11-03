# REQ-001 prototype validation

Validation date: 2026-11-03. Runtime: Node 22.22.1. Dependencies are fixed in the npm lockfile; clean installation was verified with npm 10.

## Automated checks

- `npm exec --yes --package=npm@10 -- npm ci`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed without warnings.
- `npm test -- --run`: 19 tests across 5 files passed. Coverage includes target compatibility, scenario validation, immutable job snapshots, completion/cancellation, HTTP envelopes/status codes, filtering/pagination, private-HTTP request identifiers, service recovery, form submission and report export payloads.
- `npm run build`: passed with Mock disabled; this intentionally produces an explanatory screen and does not connect to any backend.
- `VITE_ENABLE_MOCK=true npm run build`: passed; this is the artifact used for local browser review.

## Browser checks

- Created a scenario, selected it with an online compatible server, created a simulated job and inspected its completed report and configuration snapshot.
- Verified empty lists, a visible service failure containing a request ID, retry and reset. The failure control now refreshes active resources without remounting them; a StrictMode regression test covers the previously swallowed failure.
- Checked a 390 × 844 viewport: navigation drawer, scenario page and complete scenario form including save/cancel controls. The document did not overflow the viewport; wide tables scroll within their container. Temporary viewport override was reset afterwards.
- Verified the built artifact on both loopback and a specifically selected private HTTP interface. The private-origin browser loaded the seeded data and created/saved a scenario using MSW's supported fetch/XHR fallback. UUID request IDs use getRandomValues so they do not depend on secure-context-only randomUUID. Reachability from a separate phone or another network was not assumed. The preview listeners were retained at the user's request; startup/shutdown instructions are in the README.
- Clicked report export in the built artifact. The export integration test verifies the JSON MIME type, filename, simulation notice, job identifier and scenario/target snapshots. Browser security policy blocks access to the browser's internal downloads page, so the actual downloaded file's disk location/completion could not be independently confirmed. No policy workaround was attempted.

## Ant Design Pro UI refinement

The UI was refined against central conventions 1.3 and the public Ant Design Pro settings/component documentation. [ui-reference.md](ui-reference.md) records the source, the before/after comparison and the reference preview's login restriction; authenticated reference pages were not verified.

- TypeScript, lint, 19 behavior tests, and both default/Mock-enabled builds passed after the refinement.
- The revised desktop server query filtered five seeded servers to two GPU names and reset back to five. The query panel, table toolbar, navigation and breadcrumbs were inspected in the browser.
- At 390 × 844, the document width remained 390px. The light navigation drawer, labeled query form and modal save/cancel controls were inspected; a new scenario was saved successfully on the private HTTP preview.
- Existing API/Mock handlers, job state transitions, report payloads and data isolation were preserved. No dependency or backend change was introduced for the UI refinement.

## Remaining limitations

- `npm audit`: 11 moderate development-tool dependency findings, rooted in minimatch globparts amplification ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)); zero high or critical findings. The affected chain is ESLint/typescript-eslint tooling. The audit suggestions include incompatible major downgrades; no forced downgrade or cross-major dependency override was applied.
- `npm audit --omit=dev`: zero findings at validation time.
- The Mock-enabled build emits a size warning: its largest JavaScript chunk is about 1.15 MB uncompressed (370 kB gzip). Route/vendor splitting remains a later performance improvement; the warning was retained.
- Mock data is volatile, all metrics are synthetic, and no real execution, backend, persistence or authorization has been accepted. No production deployment or merge was performed.
