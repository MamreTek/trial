# Trial

MamreTek's server stress-testing product.

React + TypeScript + Ant Design interactive prototype using synthetic data. Real execution agents, backend services, authentication and authorization are not implemented. It must not be used with production systems or data.

## Local review

Use Node 22.22.1 (`.nvmrc`) and npm 10. To use npm 10 without changing the global installation: `npm exec --yes --package=npm@10 -- npm ci`.

```sh
npm ci
npm run dev
```

Open the printed localhost URL (default `http://127.0.0.1:5195`). MSW uses a Service Worker on localhost and its supported in-page fetch/XHR fallback on private HTTP origins without Service Worker support. No browser security setting changes, backend or credentials are needed. A page refresh resets all data. The header can demonstrate empty data, a one-time service failure and reset.

Review flow: inspect servers → create a CPU, HTTP or GPU scenario → create a compatible simulated job → wait around 15 seconds or cancel it → view/export the completed simulated report. Configured test duration is metadata and is distinct from accelerated demo time. Data is held in browser memory and does not persist.

Scenarios separately configure test intent (stress, load or stability) and workload (CPU/memory, HTTP or GPU). Filter the scenario list by test type; job summaries, immutable snapshots, reports and exported JSON preserve the selected type. Legacy API writes without `testType` remain accepted and default to stress. These are prototype plan fields, not implemented tool-execution strategies.

## Checks

```sh
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

The default build fails closed with an explanatory screen and never starts a real API connection. To review a built artifact locally with Mock enabled: `VITE_ENABLE_MOCK=true npm run build`, then `npm run preview`. This is a local prototype only, not a production deployment. No production hosting is configured.

For an explicitly authorized LAN review, bind only the selected private interface: `npm run preview -- --host <private-ip> --port 5195 --strictPort`. A second preview process can serve the same artifact on that private interface while the existing loopback preview keeps serving localhost. Do not bind all interfaces or change firewall rules. Other devices must be able to reach the same private network; reachability from every device is not assumed. Mock changes are separate for each browser tab/origin and disappear on reload.

Stop a foreground preview with Ctrl+C. For a retained preview, identify its exact listener PID with `ss -ltnp 'sport = :5195'` and stop only that owned preview process with `kill <pid>`. Restart by rebuilding with Mock enabled and running the same preview command. Changes to the build artifact require a browser refresh. Keep this synthetic-data preview off the public Internet.

API contract: [docs/api-contract.md](docs/api-contract.md). Shared TypeScript types, browser/Node MSW handlers and contract tests cover the same endpoints. The central development-conventions snapshot is version 1.3; the UI follows its Ant Design Pro reference requirement. The canonical REQ-001 PRD stays outside the source repository; its public tracker is [Issue #1](https://github.com/MamreTek/trial/issues/1).

## Deferred

Real hardware/tool integrations, scheduler/agents, persistent backend, production metrics, authentication, authorization and production deployment. Demonstration metrics cannot support actual hardware acceptance decisions. No existing product code or permissions were changed.
