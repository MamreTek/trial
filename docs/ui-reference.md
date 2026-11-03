# Trial UI reference and comparison

The user requested Ant Design Pro as the prototype UI baseline on 2026-11-03. This refinement implements central development conventions 1.3, section 3.1, using the project's existing React and Ant Design components. It does not migrate the framework, add Pro packages or change API/Mock contracts.

## Reference actually inspected

- The [official preview](https://preview.pro.ant.design/) reached its login page. A public demonstration login returned `Response status:0`; a repeat login submission was rejected by automatic approval review. No retry or workaround was attempted after the rejection. Authenticated dashboard/list/form pages and pixel parity were **not** verified.
- The preview's displayed source commit was `2db826cb350e46206252197f416a0a22f2b9bbfe`. Its [public settings](https://github.com/ant-design/ant-design-pro/blob/2db826cb350e46206252197f416a0a22f2b9bbfe/config/defaultSettings.ts) specify light navigation, mixed layout, fluid content, a fixed sidebar and primary color `#1890ff`.
- Public [ProLayout documentation](https://pro-components.antdigital.dev/components/layout) describes the administration shell, navigation and PageContainer headings/breadcrumbs. Public [ProTable documentation](https://pro-components.antdigital.dev/components/table) describes separate query and table areas, toolbars and pagination.

## Applied comparison

| Area | Previous Trial presentation | Revised presentation |
| --- | --- | --- |
| Shell | Dark custom sidebar, custom letter mark, separate large header | Light fixed sidebar, full-width product header, native icon, selected navigation and breadcrumbs |
| Page heading | 28px promotional title and uppercase English eyebrow | 20px business title and short functional description |
| Workbench | Large gradient guidance banner and decorative numbered steps | Actual business counts, recent-task table and compact operation links |
| Lists | Unlabeled filters inside table cards | Labeled query form in its own panel; table title, toolbar, link actions and pagination |
| Theme | Custom green accents, subtle shadows and themed panels | Shared blue tokens, neutral gray layout, white panels, standard borders and component dimensions |
| Forms | Existing validated modal forms | Preserve native labels, grouped fields, validation, save/cancel positions and submitting states; use the same neutral/blue theme |
| Mobile | Drawer navigation and responsive controls | Preserve drawer navigation; stack query fields without making the document overflow |

The performance report retains its chart and accessible sample table because time-series metrics are part of Trial's business. Chart accents follow the shared primary color. No external branding, avatars, unrelated menus or demonstration records were copied. No authentication or permission features were added or removed.

The later component/template expansion uses the same shell, labeled query panels, table toolbars and native forms. The longer template modal scrolls its body while keeping its actions reachable; component results retain tables and unit-bearing specifications. These are business additions, not a new visual direction. Current browser availability and actual verification are recorded separately in validation.md; no unobserved mobile or reference-page parity is claimed.

## Verification scope

TypeScript, lint, existing behavior tests and both default/Mock builds are rerun for this change. Browser review covers desktop filtering/reset, scene creation/editing, job/report navigation, mobile navigation/query form/modal layout and the existing loopback/private preview addresses. Results and remaining general limitations are recorded in [validation.md](validation.md).
