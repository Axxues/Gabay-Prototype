# Gabay LMS Prototype - Agent Guidelines & Constraints

## 🛠️ MANDATORY DIRECTIVE: LIKHA ERP BACKEND MODIFICATIONS & API PROTOCOLS

**Programmatic interaction, scripts, and direct API calls are the standard methods for modifying, configuring, and extending the Likha ERP (Directus) backend. The browser subagent is NO LONGER REQUIRED.**

> [!IMPORTANT]
> **ALWAYS FOLLOW THE LIKHA ERP SKILL (`likha-erp-api`):**
> Whenever any agent or developer modifies, extends, queries, or configures the Likha ERP backend (including schema, collections, fields, relations, flows, operations, permissions, or API integrations), you **MUST ALWAYS inspect and follow the instructions and protocols in the `likha-erp-api` skill** located at [`.agents/skills/likha-erp-api/SKILL.md`](.agents/skills/likha-erp-api/SKILL.md). Never perform ad-hoc operations without referencing that skill.

All agents and developers modifying the Likha ERP backend must strictly adhere to the safety rules below. Every constraint originates from a verified production crash or failure vector on the live Likha ERP instance (`https://gabay.zyberlab.com`).

---

### 🚨 Critical Safety & Crash-Prevention Guardrails

1. **CRITICAL CRASH VECTOR — NEVER `PATCH /relations`:**
   - Any `PATCH /relations/{collection}/{field}` — even with an entirely valid, verified payload — enters `RelationsService.alterType` -> `schema.collections[...].fields` -> `TypeError` -> **fatal server process crash (`HTTP 502 Bad Gateway`)**.
   - On this server, `nodemon` does NOT auto-restart; recovery requires manual server intervention (`rs` or container restart).
   - `POST /relations` is completely safe.
   - **Safe alternatives when changing a relation post-creation:**
     - **Option A (Re-creation):** Delete the relation (`DELETE /relations/{collection}/{field}`) then recreate it with desired settings (`POST /relations`).
     - **Option B (Sanctioned SQL via Flow):** Execute foreign key alterations via a webhook-triggered `likha_sql` flow (e.g., setting `ON DELETE CASCADE` or `one_deselect_action`):
       ```sql
       ALTER TABLE <junction> DROP CONSTRAINT <fk_name>,
         ADD CONSTRAINT <fk_name> FOREIGN KEY (<parent_fk>) REFERENCES <parent>(id) ON DELETE CASCADE;
       UPDATE directus_relations SET one_deselect_action='delete'
         WHERE many_collection='<junction>' AND many_field='<parent_fk>';
       ```
       Followed immediately by: `POST /utils/cache/clear {"cache":"system"}` to refresh the Directus schema cache.

2. **Cloudflare WAF / User-Agent Requirement on Writes:**
   - The hosted Likha ERP instance sits behind a Cloudflare WAF that blocks `Python-urllib/*` and generic script User-Agents on write operations (`POST`, `PATCH`, `DELETE`), returning `HTTP 403 error code: 1010`.
   - **Requirement:** Always send a standard User-Agent header (e.g., `User-Agent: curl/8.5.0` or standard browser User-Agent) on all write requests. GET requests are unaffected.

3. **URL-Encode Filter Parameters:**
   - Always URL-encode filter parameters (e.g., `filter%5Bkey%5D%5B_eq%5D=value`, not raw square brackets `filter[key][_eq]=value`). Raw brackets cause intermittent proxy and gateway 400/502 errors.

4. **Shell `$` Expansion Guardrail:**
   - Bash and PowerShell shell variable expansions silently corrupt Directus flow option templates containing `{{$trigger}}`, `{{$last}}`, or `{{$full}}`.
   - **Requirement:** Always write flow definitions, operation payloads, and scripts using dedicated script files or JSON files with UTF-8 encoding. Never pass payloads with `$` expressions via inline `python -c` or inline bash double-quoted strings. Verify stored options after patching.

5. **Idempotency & Duplicate Prevention (No Auto-Dedupe):**
   - Directus does NOT deduplicate `/panels`, `/dashboards`, `/flows`, or `/operations`.
   - Always perform an existence check (`GET` filtered by name) before creating new resources to prevent orphaned, duplicated operation chains.
   - When constructing Directus Flow operation chains, build operations **tail-first** (from last op to second op), then create or patch the first operation, and finally set `flow.operation` to the first operation ID.

6. **Webhook Trigger Method & Error Handling:**
   - Directus webhook triggers default to `GET`. Any `POST /flows/trigger/{id}` call will return `HTTP 403 Forbidden` unless `options.method: "POST"` is explicitly set on the trigger operation.
   - For public or API-facing webhook flows, always set `options.error_on_reject: true` and ensure the last operation returns a JSON-safe response body.
   - In `Run Script` operations, gate conditions using JavaScript `throw` (routes to `reject: null` cleanly), and ensure output contains no functions or circular objects (`formatter` functions cannot be cloned).
   - Set `emitEvents: false` on every operation that writes back to the trigger collection to prevent infinite event loops.

7. **Database Operations via `likha_sql`:**
   - Directus `likha_sql` operations ONLY fire when triggered via a webhook-triggered flow (`GET /flows/trigger/{id}` or `POST /flows/trigger/{id}`). Manual flow execution triggers return `403 Forbidden`.
   - `likha_sql` returns `{sql, binding, rows:[...]}` for queries. `UPDATE` statements return `rows:[]`. In downstream Run Script steps, unwrap via `data.sql_1.rows || data.sql_1`.
   - Interpolated input in `likha_sql` is NOT automatically escaped. Always sanitize user input in a prior step (`String(s).replace(/'/g, "''")`) to prevent SQL injection.
   - Raw `likha_sql` `INSERT` statements bypass Directus event hooks (`items.create`); compute any serial numbers or defaults directly in the query CTE.

8. **Directus Missing-Field 403 vs 404 Convention:**
   - In Directus, querying or filtering by a field that does not exist returns `HTTP 403 Forbidden` (`"You don't have permission to access field '<field>' or it does not exist"`), NOT `404 Not Found`.
   - Never assume a 403 error implies invalid credentials or lack of permissions alone. Check field existence via `GET /fields/{collection}`.

9. **Relational Modeling & Schema Rules:**
   - **Reverse O2M Aliases:** Created by `meta.one_field` on the relation `POST`. After creation, issue `PATCH /fields/{col}/{alias}` to set `interface: list-o2m`, `options.template`, and `meta.group` for layout tabs.
   - **M2M Junctions:** Require bidirectional `junction_field` on BOTH junction->parent relations + setting alias to `list-m2m` or `files`. A missing second side causes `"relationship not configured"` errors.
   - **Junction FK Visibility:** Junction foreign key fields (e.g. `directus_files_id`, `<parent>_id`) must NOT be marked `hidden: true`. Hiding them breaks `list-m2m` and `files` interfaces.
   - **Audit Relations (`directus_users`):** `meta.accountability: "all"` does NOT auto-create relations. Explicitly create `user_created` and `user_updated` fields and `POST /relations` to `directus_users` (`system_users`).
   - **Permission Presets:** `$CURRENT_USER` is NOT a valid `schema.default_value` (causes 500 invalid uuid). Use role permission presets: `presets: {"created_by": "$CURRENT_USER"}`.
   - **Deep Relational Payloads:** When creating parents with nested children (e.g. quizzes with questions, activities with rubrics), send nested payloads on the O2M alias so Directus commits them within a single atomic database transaction.

10. **Conventions & Environment:**
    - Likha API URL: configured via environment. Token passed via `Authorization: Bearer <LIKHA_TOKEN>`, never hardcoded or committed to git.
    - App Prefixing: Prefix application-specific collections, junctions, flows, and roles with a consistent identifier (e.g. `gabay_` or domain naming). Never modify system or external collections outside your app's domain on shared instances.

---

## 🛡️ MANDATORY DIRECTIVE: BACKEND VS. FRONTEND RESPONSIBILITY BOUNDARIES

**NEVER PLACE BACKEND-OWNED PROCESSES, CASCADES, OR ELEVATED PRIVILEGES IN THE CLIENT / FRONTEND.**

1. **No Frontend Cascade Deletions:**
   - **Rule:** The frontend application must NEVER orchestrate multi-table relational cleanup, child record discovery, or procedural leaf deletions (e.g., querying multiple tables to delete comments, items, submissions, or files before deleting a module or course).
   - **Enforcement:** Relational integrity must be enforced on the backend. Child collections must have `ON DELETE CASCADE` configured on their foreign key relationship settings in Directus (or handled via server-side Directus Flows with `Filter (Blocking)` hooks). Client code must only issue a single `DELETE /items/:collection/:id` call.

2. **Zero Service Credentials or Elevation in the Frontend:**
   - **Rule:** Never embed superadmin, service account credentials (e.g., `getLikhaServiceToken` with hardcoded emails/passwords), or client-side elevation shims (`likhaElevatedRequest`) in the frontend bundle.
   - **Enforcement:** All operations performed by a client must authenticate strictly with the active user's session JWT. If an operation requires elevated permissions, it MUST be executed on the backend (via Directus Flows with System execution, or backend endpoints). Any permissions required for legitimate LMS user roles (e.g., faculty deleting their own module or course, students uploading their submission) must be granted through Directus role policies, NOT frontend privilege escalation.

3. **No Unhashed Sensitive Credentials in Client Storage:**
   - **Rule:** Never store user passwords, candidate passwords, or unhashed sensitive credentials in `localStorage`, `sessionStorage`, or client state.
   - **Enforcement:** Registration and password management must use secure Directus authentication flows or backend invite tokens, never plain text in client storage.

4. **Atomic Transactions Over Loose Multi-Roundtrip Mutations:**
   - **Rule:** Multi-step operations (e.g., grading with rubric criteria scores and comments, cross-section content replication) must not rely on loose, sequential client loops that leave partial database state upon network failure.
   - **Enforcement:** Where atomicity is required, leverage Directus Flows, database foreign keys, or batch endpoints.

---

## 🏗️ MANDATORY DIRECTIVE: FEATURE-BASED FRONTEND FOLDER ARCHITECTURE

**THE FRONTEND (`client/src/`) MUST STRICTLY ADHERE TO DOMAIN-DRIVEN, FEATURE-BASED ENCAPSULATION.**

1. **Feature Encapsulation & Domain Colocation:**
   - Every major domain slice in the application must reside within its dedicated folder under `client/src/features/<domain>/` (e.g., `auth`, `accounts`, `courses`, `syllabus`, `modules`, `assessments`, `calendar`, `inbox`, `people`, `files`, `rag`, `dashboard`, `system`).
   - All domain-specific elements MUST be co-located inside their owning feature directory:
     - Pages / Views (`*Page.tsx`, `*View.tsx`)
     - Sub-components (`components/`)
     - Feature-specific hooks (`hooks/`)
     - Feature-specific API clients / fetchers (`api/`)
     - Feature-specific utilities and parsers (`utils/`)
     - Feature-specific types and DTOs (`types.ts` or `types/`)
     - Feature-specific context/stores (`context/` or `state/`)
     - Unit & integration tests (`*.test.ts`, `*.test.tsx`)
   - **DO NOT** place domain-specific utilities, modals, API calls, types, or hooks into `client/src/shared/`.

2. **Strict Public API via Barrel Exports (`index.ts`):**
   - Every feature folder MUST maintain an `index.ts` file that explicitly defines its public API.
   - **Zero Deep Internal Imports:** Consumers outside a feature (e.g., `App.tsx`, sibling features) are **STRICTLY FORBIDDEN** from importing deep internal paths (e.g., `import { ... } from '../features/assessments/components/forms/QuizBuilderFields'`). External consumers MUST only import from the feature's root barrel:
     ```typescript
     // ✅ Permitted:
     import { ActivitiesView, SpeedGraderModal } from '../features/assessments';
     import { CoursesPage } from './features/courses';
     
     // ❌ Strictly Forbidden:
     import { SpeedGraderModal } from './features/assessments/components/grading/SpeedGraderModal';
     import { ActivitiesView } from '../assessments/ActivitiesView';
     ```
   - If a sibling feature or app router requires a component, hook, or type from a feature, that entity MUST be deliberately exported in the feature's `index.ts`.

3. **Strict Boundaries for `client/src/shared/`:**
   - `client/src/shared/` is exclusively reserved for **domain-agnostic foundational primitives**:
     - Generic UI primitives (`DialogFrame`, `CustomDropdown`, `AppSkeleton`, `PageTransition`, `ModalPortal`)
     - Global shell layouts (`AppRail`, `Topbar`, `LMSContextPanel`)
     - Truly generic utilities (date formatters, avatar initials, promise concurrency pool)
     - Base HTTP client / token interceptor (`client.ts`)
     - Global routing utilities (`routes.ts`, `navigation.ts`)
   - **Zero Inverted Dependencies:** Files inside `client/src/shared/` MUST NEVER import from `client/src/features/`. Any test or utility in `shared/` that requires a feature component or domain logic is misplaced and must be moved into that feature.

4. **Acyclicity & Minimal Cross-Feature Coupling:**
   - Features must not form circular dependencies (e.g., `courses` importing from `dashboard` while `dashboard` imports from `courses`).
   - Shared cross-domain entities (such as academic semester normalization or institutional role enums) belong in `shared/`, not inside one specific feature if another feature depends on it.
   - Cross-feature workflows should prefer composition, URL parameters, or shared event/navigation contracts over tight component coupling.

5. **Local Feature State Over Monolithic Expansion:**
   - New feature state, caching, and data operations must be authored as feature-scoped hooks, stores, or query endpoints inside `features/<domain>/`, NEVER added to the global `LMSContext.tsx` monolith.

---

## ⚡ MANDATORY DIRECTIVE: TOKEN EFFICIENCY & MINIMALISM (PONYTAIL MODE)

**ALL AGENTS MUST MINIMIZE CONTEXT CONSUMPTION, OUTPUT TOKENS, AND CODE CHURN.**

1. **The Smallest Complete Change (YAGNI & Ponytail):**
   - Solve tasks with the smallest working diff. Do NOT introduce new layers, wrappers, abstract classes, defensive boilerplate, or speculative features nobody asked for.
   - Deletion and reuse beats addition: reuse existing components, utilities, and dependencies instead of writing new ones.

2. **Ultra-Concise Communication:**
   - Answer directly and plainly. Do NOT re-explain the prompt, summarize what the user already knows, or offer unsolicited lectures.
   - Summarize edits in 1–3 concise sentences.

3. **Tool & Context Hygiene (Zero Transcript Bloat):**
   - **Targeted File Reads:** ALWAYS read specific line ranges (`StartLine`, `EndLine`). NEVER dump full 500+ line files into the session transcript unless strictly necessary.
   - **Targeted Edits:** ALWAYS use `edit_file` for targeted surgical replacements; never overwrite entire files with `write_file` for partial changes.
   - **Concise Command Output:** Filter console and test outputs (pipe to head/tail, use `--silent`, `--summary`, or `Select-String`) to avoid dumping hundreds of log lines into context history.

