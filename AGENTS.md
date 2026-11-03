# Trial development

Read the central Mamre development standards before work when available. The portable fallback is `docs/development-conventions.md`, version 1.2. Explicit user instructions and project decisions take precedence.

Trial is currently a React + TypeScript + Ant Design product prototype with synthetic data. Keep all API access in the shared client and keep the contract, Mock handlers and documentation consistent. Do not add real execution, production data or permissions in this phase.

Use the Mamre workflow record matching this repository's origin. Requirements remain outside this source repository. Work on issue branches and deliver through pull requests; do not merge or deploy without authorization. Preserve unrelated changes and never commit secrets or machine-local workflow state.
