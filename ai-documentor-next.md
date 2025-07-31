1 · Core Use-Case Narrative (“Job-to-be-Done”)
*“When a non-developer stakeholder (e.g. salesperson, customer-success rep, product manager) is staring at the live web app and wonders, ‘What happens when I click this button?’, AI-Documentor should answer—instantly—via a clean, hyperlinked documentation site.

The doc page for any UI element must tell a human, in plain English, (a) which front-end component renders it, (b) what backend route / serverless function it calls, and (c) which DB tables / collections the request reads or writes. All cross-references should be one click away.”*

Key constraints ⇢

Works from the command line (npx ai-documentor scan), no SaaS upload needed.

Runs in CI or locally; language-agnostic but starts with JS/TS/React + Node/Express + SQL/Prisma/Sequelize.

Produces a static, self-hosted site (think Confluence-style) under docs/ or /ai-documentor-site/.

Zero manual annotation required; relationships are inferred via parsing and light heuristics.

2 · End-Product Blueprint
Below is a sample Markdown/MDX outline the tool should emit for a page about a single button called “Save Invoice”. Use it as a golden reference:

md
Copy
Edit
# UI Element: Save Invoice Button

> **Location**: `/src/pages/invoices/[id]/InvoiceEditor.tsx`  
> **Rendered By**: `<SaveButton />` @ line 87  
> **User Flow**: “Invoice Editing”

---

## 1. Front-End Behaviour

| Prop | Current Value | Source of Truth |
|------|---------------|-----------------|
| `disabled` | `isSaving || !isDirty` | component state |
| `onClick`  | `handleSaveInvoice` | line 92 |

### 1.1 handleSaveInvoice (↗ source)
```ts
await api.invoices.update(id, values)        // POST /api/invoices/:id
toast.success('Saved!')
2. Backend Interaction
HTTP	Route	Handler	File	Lines
POST	/api/invoices/:id	updateInvoice	api/invoices.ts	48-103

updateInvoice (↗ source)
Validates payload via zod schema InvoiceInput

Writes invoices table using Prisma

Emits event INVOICE_UPDATED

3. Data Model Touchpoints
Table	Operation	Columns
invoices	UPDATE	amount, due_date, status
audit_log	INSERT	entity_id, action, actor_id

4. Related Pages / Components
Invoice List Page – uses same INVOICE_UPDATED event.

Notifications Panel – displays toast when status === 'OVERDUE'.

Last generated: 2025-07-31 by AI-Documentor v0.9

markdown
Copy
Edit

**Global site nav** should include:

1. **Overview** (architecture diagram, module map)  
2. **Pages** → each top-level route  
3. **UI Elements** (buttons, links, forms) – searchable index  
4. **API Endpoints**  
5. **Data Models** (tables, schemas, collections)  
6. **Event Bus / Pub-Sub Topics** (optional)

All headings become anchors; every file path links to the prettified source snippet with syntax highlighting.

---

## 3 · Analysis Pipeline Design

> **Goal:** Build a graph `G = (Nodes, Edges)` where nodes = {UI_Element, Component, API_Endpoint, DB_Entity} and edges express “renders”, “calls”, “queries”, etc. Then render docs from that graph.

| Stage | Key Tools / Libraries | Purpose |
|-------|-----------------------|---------|
| **1. Project Discovery** | `fast-glob`, `tsconfig-paths` | crawl repo; respect `tsconfig` / `eslintignore`; detect mono-repos |
| **2. AST Parsing (Front-End)** | **Babel** + `@babel/parser` (`typescript`, `jsx`) | generate AST; capture `JSXOpeningElement` → UI elements; extract `onClick`, API utility imports |
| **3. Static Call-Graph** | `eslint-scope` or `@typescript-eslint/scope-manager` | map from component functions → API util calls (`fetch`, `axios`, `api.*`) |
| **4. API Layer Analysis** | Babel again on `api/**` or `pages/api/**`; pattern-match Express/Next handlers; derive route, HTTP verb, param schema (infer via `zod`, `yup`, `express-validator`) |
| **5. DB Access Extraction** | Regex + AST for `prisma.<model>`, `sequelize.*`, raw `sql\`` strings; store CRUD op & columns touched |
| **6. Graph Assembly** | `graphlib` or plain JS objects; de-duplicate nodes by slug; store source-file meta |
| **7. Output Rendering** | `mdast` + `mdast-util-to-hast` → Markdown → `Docusaurus`, `Nextra`, or custom static generator; create per-node pages + backlinks |
| **8. UX Polish** | search powered by `Lunr.js`; dark-mode toggle; copy-link button for headings |

*Performance Tips*  
- Use Babel’s **lazy parsing** and limit AST depth for gigantic vendor files.  
- Cache hashes per file; only re-parse changed files (good for CI).  
- Make DB extraction pluggable (support Prisma first, Sequelize next, raw SQL last).

---

## 4 · Concrete Roadmap & Tasks for Claude Code

| Priority | Epic | Acceptance Criteria |
|----------|------|---------------------|
| **P0** | **Foundational Graph Core** | CLI builds `graph.json` with nodes & edges for: JSX Buttons → fetch/axios → Express route → Prisma table. |
| **P1** | **MDX Site Generator** | Given `graph.json`, produce static site identical to sample blueprint; sidebar auto-generated; every file path links to code snippet. |
| **P1** | **Source Snippet Renderer** | Embed 30-line excerpt around each symbol with syntax highlight + “↗ source” link opening full file. |
| **P2** | **ORM Plug-ins** | Abstract DB extraction; ship Prisma plugin; stub for Sequelize & Mongoose. |
| **P2** | **Incremental Build Cache** | Skip unchanged files via `content-hash` stored in `.ai-documentor/cache.json`. |
| **P3** | **Language Extensibility** | Scaffold analyzers for Python FastAPI + SQLAlchemy (proof-of-concept). |
| **P3** | **Design Polish** | Add lighthouse-score-friendly theme, mobile nav, search autosuggest. |
| **P4** | **Advanced Flow Mapping** | Detect React Router path → page; construct “User Flow” diagrams (Mermaid) that chain multiple UI elements & routes. |
| **P4** | **CI Integration** | Provide GitHub Action: `uses: aleclindz/ai-documentor-action@v1` – uploads `docs/` as GitHub Pages. |

_Note: mark each task’s PR with “Closes #X” and attach screenshot of generated page for manual review._

---

### “Definition of Awesome”

- A PM unfamiliar with the codebase can land on `/docs/ui/save-invoice-button` and, within **15 seconds**, click through to see the exact DB columns affected.  
- Running `npx ai-documentor scan && npx ai-documentor build` on a 2k-file monorepo finishes in **< 90 s** on an M3 MacBook.  
- Docs site passes accessibility audit (WCAG 2.1 AA) out of the box.

---