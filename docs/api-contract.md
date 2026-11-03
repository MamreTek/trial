# Trial prototype API contract · v1

All samples and results are synthetic. This contract describes the future backend interface; no backend, real execution or authorization exists. The browser sends same-origin JSON requests through `src/shared/api/client.ts`; MSW intercepts them. Authoritative TypeScript shapes: `src/shared/api/contracts.ts`. Handler behavior: `src/mocks/handlers.ts`, with validations and state transitions in `src/mocks/store.ts`. The test suite exercises these exact handlers.

## Common behavior

Prefix: `/api/v1`. Content-Type: `application/json`. IDs are opaque strings. Dates are ISO 8601 UTC. Success: `{ "data": <resource>, "requestId": "<uuid>" }`. Lists wrap data as `{ "items": [], "total": 0, "page": 1, "pageSize": 10 }`. Errors: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fieldErrors": { "name": "..." } }, "requestId": "<uuid>" }`; fieldErrors is optional. HTTP 400 = invalid parameters/JSON or incompatible target, 404 = missing resource, 409 = invalid state, 503 = simulated service failure. Client timeout: 8 seconds. No automatic write retries. The client displays error messages with request IDs.

List query: `page` integer >=1 (default 1), `pageSize` integer 1..100 (default 10), `q` case-insensitive name substring, `sort` as specified below (default `name`). Filtering precedes sorting and pagination; `total` is the filtered count. Unknown query keys are ignored. An empty list is HTTP 200.

| Method | Path | Request / query | Success data |
| --- | --- | --- | --- |
| GET | `/servers` | common list query; `brand=Dell\|HPE\|Lenovo`, `status=online\|offline`, sort `name`/`-name` | `Page<Server>` |
| GET | `/servers/:id` | opaque server ID | `Server` |
| GET | `/scenarios` | common list query; `testType=stress\|load\|stability`; sort `name`/`-name`/`updatedAt`/`-updatedAt` | `Page<Scenario>` |
| GET | `/scenarios/:id` | opaque scenario ID | `Scenario` |
| POST | `/scenarios` | `ScenarioInput` | HTTP 201 `Scenario` |
| PATCH | `/scenarios/:id` | complete `ScenarioInput` replacement, same ID | `Scenario` |
| GET | `/jobs` | common list query; `status=queued\|running\|completed\|canceled`, sort `name`/`-name`/`createdAt`/`-createdAt` | `Page<Job>` |
| GET | `/jobs/:id` | opaque job ID | `Job` |
| POST | `/jobs` | `JobInput` | HTTP 201 `Job` |
| POST | `/jobs/:id/cancel` | no body | `Job`, or 409 for terminal jobs |
| GET | `/jobs/:id/report` | completed job only | `Report`, or 409 `REPORT_NOT_READY` |

## Resource fields

- Server: `id`, `name`, `brand`, `model`, `address` (documentation-only sample address), `status` (simulated Agent state), `cpu` model, `cores`, `memoryGiB`, nullable `gpu` model, `gpuCount`, `location`. All hardware values are samples, not discovered inventory.
- ScenarioInput: `name` trimmed 2–60 characters, optional `testType=stress|load|stability`, `workload=cpu|http|gpu`, `tool`, `durationMinutes` integer 1–1440, `concurrency` integer 1–10000, `intensityPercent` integer 1–100. Compatible tools: CPU → stress-ng; HTTP → JMeter/Locust; GPU → gpu-burn. Names need not be unique. Unknown body fields are ignored; explicitly listed fields are copied.
- Scenario: ScenarioInput plus `id`, required normalized `testType`, and `updatedAt` UTC. PATCH replaces the complete scenario input; required fields must be supplied. Future partial-update semantics would need an explicit contract change.
- JobInput: `name` trimmed 2–60 characters, existing `scenarioId`, non-empty `serverIds` without duplicates. All targets must be online, GPU scenarios require every target to have `gpuCount>0`. Missing referenced resources return 404; incompatible resources return 400.
- Job: `id`, `name`, immutable `scenario` and `servers` snapshots, `status`, `progress` 0..100, `createdAt`, nullable `finishedAt`.
- Report: `jobId`, `simulated=true`, `generatedAt`, `workload`, scenario and target snapshots, `verdict` (the literal demonstration label “示例通过”), `metrics[]` with `label/value/unit`, and `series` with `label/unit/samples[]` of `second/value`. CPU, HTTP and GPU reports have workload-specific metrics. Export adds a simulation notice and preserves the API data.

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
{"data":{"id":"job-4","name":"GPU acceptance demo","scenario":{"id":"scn-003","name":"GPU 长稳测试","testType":"stability","workload":"gpu","tool":"gpu-burn","durationMinutes":120,"concurrency":4,"intensityPercent":95,"updatedAt":"2026-11-03T07:10:00Z"},"servers":[{"id":"srv-002","name":"lab-gpu-01","brand":"Dell","model":"PowerEdge R750xa","address":"192.0.2.12","status":"online","cpu":"Intel Xeon Gold 6338","cores":64,"memoryGiB":512,"gpu":"NVIDIA A100 80GB","gpuCount":4,"location":"模拟实验室 A · 机架 02"}],"status":"queued","progress":0,"createdAt":"2026-11-03T08:00:00.000Z","finishedAt":null},"requestId":"00000000-0000-4000-8000-000000000001"}
```

Mock transitions on reads: queued until 1.5s, running until 15s, then completed at 100%. Configured duration remains metadata; simulated sampling seconds are separately labeled. queued/running → canceled is terminal and records a finish time. completed/canceled cannot restart or cancel. Only completed has a report. Polling uses the same GET endpoints, no hidden execution endpoint. Editing a scenario never changes existing job snapshots. Report generation time equals the job finish time, so repeated GETs are stable.

The header's empty/next-failure/reset controls are browser-local testing utilities, not backend APIs. Fail mode affects exactly one next request and then recovers. Empty mode affects lists and preserves underlying examples; reset restores seeded data. Refresh clears all modifications.

## Backend handoff

Keep the client interface and paths stable when implementing a backend. Replace the Mock bootstrap with an explicitly reviewed real adapter and validate against the same success/error/request examples and tests. Real services must implement durable job state, execution agents, resource validation, cancellation, timeout behavior, authentication/authorization and production safeguards. None of those are provided by this prototype.
