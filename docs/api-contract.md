# Trial prototype API contract · v1

All samples and results are synthetic. This contract describes the future backend interface; no backend, real execution or authorization exists. The browser sends same-origin JSON requests through `src/shared/api/client.ts`; MSW intercepts them. Authoritative TypeScript shapes: `src/shared/api/contracts.ts`. Handler behavior: `src/mocks/handlers.ts`, with validations and state transitions in `src/mocks/store.ts`. The test suite exercises these exact handlers.

## Common behavior

Prefix: `/api/v1`. Content-Type: `application/json`. IDs are opaque strings. Dates are ISO 8601 UTC. Success: `{ "data": <resource>, "requestId": "<uuid>" }`. Lists wrap data as `{ "items": [], "total": 0, "page": 1, "pageSize": 10 }`. Errors: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fieldErrors": { "name": "..." } }, "requestId": "<uuid>" }`; fieldErrors is optional. HTTP 400 = invalid parameters/JSON or incompatible target, 404 = missing resource, 409 = invalid state, 503 = simulated service failure. Client timeout: 8 seconds. No automatic write retries. The client displays error messages with request IDs.

List query: `page` integer >=1 (default 1), `pageSize` integer 1..100 (default 10), `q` case-insensitive name substring, `sort` as specified below (default `name`). Filtering precedes sorting and pagination; `total` is the filtered count. Unknown query keys are ignored. An empty list is HTTP 200.

| Method | Path | Request / query | Success data |
| --- | --- | --- | --- |
| GET | `/servers` | common list query; `brand=Dell\|HPE\|Lenovo`, `status=online\|offline`, sort `name`/`-name` | `Page<Server>` |
| GET | `/servers/:id` | opaque server ID | `Server` |
| GET | `/components` | list query; `kind`, exact `manufacturer`, `serverId`; sort `name`/`manufacturer`/`model` with optional `-` | `ComponentPage` |
| GET | `/components/:id` | opaque component ID | `HardwareComponent` |
| GET | `/tools` | no query | `ToolDefinition[]` |
| GET | `/scenarios` | list query; `testType=stress\|load\|stability`, `workload=cpu\|memory\|disk\|network\|gpu\|http`; sort `name`/`-name`/`updatedAt`/`-updatedAt` | `Page<Scenario>` |
| GET | `/scenarios/:id` | opaque scenario ID | `Scenario` |
| POST | `/scenarios` | `ScenarioInput` | HTTP 201 `Scenario` |
| PATCH | `/scenarios/:id` | complete `ScenarioInput` replacement, same ID | `Scenario` |
| GET | `/jobs` | common list query; `status=queued\|running\|completed\|canceled\|failed`, sort `name`/`-name`/`createdAt`/`-createdAt` | `Page<Job>` |
| GET | `/jobs/:id` | opaque job ID | `Job` |
| POST | `/jobs` | `JobInput` | HTTP 201 `Job` |
| POST | `/jobs/:id/cancel` | no body | `Job`, or 409 for terminal jobs |
| GET | `/jobs/:id/report` | completed job only | `Report`, or 409 `REPORT_NOT_READY` |

## Resource fields

- Server: `id`, `name`, `brand`, `model`, `address` (documentation-only sample address), `status` (simulated Agent state), `cpu` model, `cores`, `memoryGiB`, nullable `gpu` model, `gpuCount`, `location`. All hardware values are samples, not discovered inventory.
- ScenarioInput: `name` trimmed 2–60 characters, optional `testType=stress|load|stability`, `workload=cpu|memory|disk|network|gpu|http`, matching `tool`, `durationMinutes` integer 1–1440, `concurrency` integer 1–10000, `intensityPercent` integer 1–100. Optional `parameters/toolVersion/termination` are defined in [component-testing.md](component-testing.md). Names need not be unique. Unknown top-level body fields are ignored; unknown parameter/termination keys are rejected.
- Scenario: ScenarioInput plus `id`, normalized required `testType/parameters/toolVersion/termination`, and `updatedAt` UTC. PATCH replaces the complete input. Omitted extension fields reset to catalog defaults; send them back when preserving a saved plan. Existing CPU/HTTP/GPU requests remain accepted.
- JobInput: `name` trimmed 2–60 characters, existing `scenarioId`, non-empty unique `serverIds`, optional non-empty unique `componentIds`. All targets must be online. Components must match the workload/tool, belong to and cover selected servers, and fit capacity checks. Without componentIds, hardware jobs select the first compatible component per server in stable inventory order; HTTP uses none and must omit the field. gpu-burn requires NVIDIA CUDA, not just a GPU count. Unknown IDs return 404, incompatible/capacity targets return 400, external/unverified tools return 409 TOOL_UNAVAILABLE.
- Job: `id/name/scenario/servers/components/status/progress/createdAt/finishedAt/completedRounds`, plus optional `failure={code,message,retryable}`. Scenario, tool revision, parameters and components are immutable snapshots. completedRounds is zero for duration mode, otherwise the number of completed simulated rounds.
- Report: `jobId/simulated/generatedAt/workload/scenario/servers/verdict/metrics/series/completedRounds/componentResults`. Each component result contains its snapshot (including measurementScope) and label/value/unit metrics. Top-level metrics/curve describe only the first associated component; they are not an aggregate score. HTTP has no componentResults. Export adds the simulation notice and preserves all fields.

Component resources, parameter schemas, measurement scopes, tool availability and termination rules are part of this v1 contract and are fully described in [component-testing.md](component-testing.md).

### Test-type compatibility

`stress` = 压力测试, `load` = 负载测试, `stability` = 稳定性测试. These types express test intent independently of the CPU/HTTP/GPU workload and tool. POST/PATCH requests that omit `testType` normalize it to `stress`, preserving acceptance of legacy payloads; explicit null, empty strings, unsupported values and non-string types return HTTP 400 with `fieldErrors.testType`. Include the current type in a PATCH when preserving it. Scenario responses always contain the normalized field, and existing job/report snapshots retain their original value even if the scenario is later edited.

The optional list filter is applied before keyword filtering, sorting and pagination. An absent/empty filter means all types; a non-empty unsupported filter returns HTTP 400. The prototype stores the type as plan metadata: it does not implement real workload strategies or change its accelerated 15-second simulation based on this field.

## Examples and transitions

```json
{"name":"GPU stability demo","testType":"stability","workload":"gpu","tool":"gpu-burn","durationMinutes":120,"concurrency":4,"intensityPercent":95}
```

```json
{"name":"GPU acceptance demo","scenarioId":"scn-003","serverIds":["srv-002"]}
```

```json
{"data":{"id":"scn-003","name":"GPU 长稳测试","testType":"stability","workload":"gpu","tool":"gpu-burn","toolVersion":"source@0d19c94dcb2e9b6858b7586a4c327674cd67113b","parameters":{"gpuMemoryPercent":80,"precision":"fp32"},"termination":{"mode":"duration"},"durationMinutes":120,"concurrency":4,"intensityPercent":95,"updatedAt":"2026-11-03T07:10:00Z"},"requestId":"00000000-0000-4000-8000-000000000001"}
```

Normal Mock transitions on reads: queued until 1.5s, running until 15s, then completed at 100%. Configured duration remains metadata; simulated sampling seconds are separately labeled. Injected timeout/tool-error outcomes fail at 10.5s/12.3s with progress 66/80 and failure.code TIMEOUT/TOOL_EXIT_NONZERO. Failed/completed/canceled are terminal and cannot be canceled again. Only completed has a report; failures cannot export success. Polling uses the same GET endpoints. Editing a scenario never changes snapshots. Report generation time equals finish time, so repeated GETs are stable.

The header's empty/next-request-failure/next-job-error/next-job-timeout/reset controls are browser-local utilities, not backend APIs. A request failure consumes one next request. Job outcomes consume one successfully created job only; validation failures do not consume them. There is no outcome-injection field in JobInput. Empty mode affects lists and preserves underlying examples; reset restores seeds. Refresh clears modifications.

## Backend handoff

Keep the client interface and paths stable when implementing a backend. Replace the Mock bootstrap with an explicitly reviewed real adapter and validate against the same success/error/request examples and tests. Real services must implement durable job state, execution agents, resource validation, cancellation, timeout behavior, authentication/authorization and production safeguards. None of those are provided by this prototype.
