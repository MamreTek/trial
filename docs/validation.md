# REQ-001 prototype validation

Validation date: 2026-11-03. Runtime: Node 22.22.1. Dependencies are fixed in the npm lockfile; clean installation was verified with npm 10.

## Automated checks

- `npm exec --yes --package=npm@10 -- npm ci`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed without warnings.
- `npm test -- --run`: 59 tests across 8 files passed. Coverage includes target compatibility, scenario validation, immutable job snapshots, completion/cancellation/failure, HTTP envelopes/status codes, component filtering/pagination/capacity, per-type tab columns, keyboard navigation/query isolation, private-HTTP request identifiers, service recovery, parameter/termination forms and report export payloads.
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
- Component test files run serially to avoid competing Ant Design/jsdom style calculations on small CI runners. All behavior assertions and the existing per-test time limits remain enabled.
- Component queries are scoped to the relevant modal/native button instead of repeatedly computing accessible names for unrelated page controls. The form test verifies actual dialog-node removal and still checks validation, saved content and the API result; recovery retains visible button-role and error/retry assertions.

## Independent test-type refinement

- Scenarios now model stress/load/stability independently of CPU/HTTP/GPU workloads. Tests cover all three types, legacy writes defaulting to stress, rejection of invalid types, type filtering before pagination, and unchanged job/report snapshots after editing the source scenario.
- The form regression selects stability for a CPU scenario, saves it, verifies its visible result and normalized API data. A separate regression filters stability scenarios across CPU/GPU workloads and resets the list. Report-export assertions include the stored test type. The initial combined UI sequence passed locally but exceeded its 15-second limit in CI; save and filtering are now independent test cases, retaining all assertions and the same per-test limit.
- All 28 tests, TypeScript and lint passed locally after that split. Default/Mock application build inputs were unchanged by the test-only adjustment.
- Both default and explicitly Mock-enabled builds passed. No dependency or real execution change was introduced.
- Loopback and the selected private-interface preview listeners were restarted after the environment interruption. Both returned HTTP 200, with no wildcard/public binding or firewall change. Startup and shutdown commands remain in the README.
- Current browser discovery returned no enabled browser (`browsers: []`). The new selection → job → report browser walkthrough and refreshed 390px viewport check could not be repeated. The earlier browser checks above apply to the preceding prototype; component/API tests do not constitute new browser or physical-phone acceptance.

## Component and parameterized-template expansion

- Added synthetic CPU/memory/disk/network/GPU inventories with manufacturer/model, unit-bearing specs, sample metrics, compatibility and explicit measurement scope. Component queries, details, facets and tool schemas pass through the shared HTTP client/handlers.
- Tool references and license/support boundaries are in [component-testing.md](component-testing.md). Tests reject AMD/ROCm as a gpu-burn target and prevent tasks for offline Memtest86+ and unverified CPU_SPEC_2007 templates. No third-party tool code, executable, installation or real target connection was introduced.
- Parameter/termination validation covers unsupported keys/options/types/versions, numeric bounds and the overall rounds budget. Explicit components enforce ownership, type, online status, tool compatibility and memory/disk/link capacity. Legacy server-only requests select a deterministic compatible component.
- Job/report/export checks preserve reference revisions, parameters, termination, component snapshots and completed rounds. Per-component data retains its measurement scope; first-component summary metrics are not represented as aggregate scores.
- Failure/timeout harness outcomes affect one next successfully created job, remain terminal, and cannot produce a success report or be canceled again. Existing status, HTTP and backward-compatibility checks still pass.
- UI tests cover model search and drawer specifications, switching CPU to memory without leaking old parameter keys, editing rounds while retaining memory parameters, and creating a component-specific job from the inventory handoff. Role/label queries are scoped to relevant controls; original assertions and 15-second case limits remain enabled. The full local suite passed in about 69 seconds.
- Current browser discovery again returned no enabled browsers. Desktop/mobile visual review and a physical-phone walkthrough remain unverified for this expansion. Component/API checks are not browser acceptance; the earlier screenshots belong to the preceding prototype.

## Component type tabs

- The inventory defaults to CPU and presents separate CPU/memory/disk/network/GPU tabs. Each active table queries the existing kind filter and shows only its own specification/metric columns with units, plus manufacturer/model. Previous-type rows are filtered out immediately during asynchronous tab changes.
- Seven added cases cover all five type-specific tables, one active table at a time, keyboard focus/selection and panel association, and independent query restoration. The existing network detail test now opens the network tab before its search; detail and task handoff checks remain intact. Native positional announcements for focused tabs are preserved.
- TypeScript, lint and the complete 59-test suite passed locally (about 94 seconds after the form-test adjustment below). Existing assertions and 15-second case limits were retained. Queries inside waits use the relevant cached table to avoid repeated unrelated accessibility/style calculations.
- A PR runner exceeded 15 seconds in the existing CPU-to-memory template form case while all seven tab cases passed. Form tests now omit preparatory hover events, which they do not assert, and use scoped labels/cached controls. Default pointer checks, actual clicks, saved/API data assertions and original case limits remain enabled. The seven affected form cases passed locally; the previously slow case took about 7.8 seconds.
- API routes, schemas, Mock fixtures, template/parameter/report behavior and dependencies did not change. Presentation documentation was updated; the API contract requires no revision. The applicable central convention snapshot and project record were synchronized to 1.4, and the snapshot matches its canonical contents.
- Current browser discovery returned apps:[] and browsers:[]. The tab layout and phone viewport were not manually browser-verified; semantic/component checks do not constitute visual or physical-device acceptance. Native tab navigation and table overflow handling are retained.

## Remaining limitations

- `npm audit`: 11 moderate development-tool dependency findings, rooted in minimatch globparts amplification ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)); zero high or critical findings. The affected chain is ESLint/typescript-eslint tooling. The audit suggestions include incompatible major downgrades; no forced downgrade or cross-major dependency override was applied.
- `npm audit --omit=dev`: zero findings at validation time.
- The Mock-enabled build emits a size warning: its largest JavaScript chunk is about 1.18 MB uncompressed (380 kB gzip). Route/vendor splitting remains a later performance improvement; the warning was retained.
- The existing report snapshot can emit an Ant Design Descriptions span/column warning under jsdom. Its field/export checks pass; browser layout acceptance is still pending. The tab change does not modify that report layout.
- Mock data is volatile, all metrics are synthetic, and no real execution, backend, persistence or authorization has been accepted. No production deployment or merge was performed.
