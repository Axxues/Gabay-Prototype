# Gabay LMS Prototype - Agent Guidelines & Constraints

## 🚨 MANDATORY DIRECTIVE: LIKHA ERP BACKEND MODIFICATIONS

**DO NOT USE DIRECTUS REST / DDL ENDPOINTS TO MODIFY THE LIKHA ERP BACKEND — IN CODE, VIA SCRIPTS, OR VIA BROWSER CONSOLE.**

1. **Strict DOM-Only Interaction via Browser Subagent:**
   - Whenever you need to alter, configure, or inspect Likha ERP data models, collections, fields, relations, interfaces, or system settings, you **MUST use the browser subagent (`browser_subagent`)** navigating `https://gabay.zyberlab.com/admin`.
   - **DOM-ONLY INTERACTION RULE:** The browser subagent must interact **strictly and exclusively through synthetic mouse clicks (`click`), dropdown selections, and form inputs (`fill_form`) on the rendered HTML interface**.
   - **ZERO IN-BROWSER SCRIPTED API CALLS:** The browser subagent is **STRICTLY FORBIDDEN** from using `evaluate_script`, `page.evaluate()`, `window.fetch()`, `XMLHttpRequest`, or browser console scripts to issue `POST`, `PATCH`, or `DELETE` requests against `/relations`, `/fields`, `/collections`, `/schema`, or any system endpoints. Calling REST DDL from inside the browser console is just as fatal as calling it from curl.

2. **Mandatory Guardrail in Subagent Prompts:**
   - Every prompt provided to a browser subagent targeting Likha ERP MUST explicitly include this negative constraint:
     > *"CRITICAL RESTRICTION: You must ONLY configure settings by clicking DOM elements (`click`) and typing into inputs (`fill_form`). You are STRICTLY PROHIBITED from using `evaluate_script` or console execution to call `fetch()` against `/relations`, `/fields`, or `/collections`. Scripted schema calls crash the Directus server (502 Bad Gateway). If a button or setting is not clickable in the UI, or if an error toast appears, STOP IMMEDIATELY and report it."*

3. **Strict Stop-on-Error Protocol (Zero "Creative" Script Workarounds):**
   - When an LLM subagent encounters an unexpected state (such as a disabled button, a red toast alert, or an unexpected validation error), it is **STRICTLY FORBIDDEN from attempting alternative scripted fallbacks or console workarounds**.
   - The subagent must stop immediately, capture the exact UI message or snapshot, and return control to the user.

4. **Sequential, Single-Tab Operations (No Concurrency or Lock Contention):**
   - Directus acquires exclusive database table locks (`ACCESS EXCLUSIVE`) during schema alterations and triggers schema cache rebuilds.
   - The browser agent must operate strictly in a single tab, modifying one field at a time sequentially.
   - Always wait for the save checkmark/spinner to complete and the UI to settle before navigating to the next collection or field.

5. **Pre-Constraint Orphan Record Hygiene:**
   - In PostgreSQL, altering a foreign key to `ON DELETE CASCADE` or creating a foreign key relationship will fail with a foreign key violation error if the child table contains existing "orphan" records (rows referencing parent IDs that do not exist).
   - If an orphan violation occurs in the UI, do NOT attempt to force it via DDL. The orphaned child records must be identified and cleared or re-assigned via normal item deletion (`/items/:collection/:id` or Content UI) first.

6. **No Direct Writes to Directus System Collections (`directus_*`):**
   - Never issue `POST`, `PATCH`, or `DELETE` against `/items/directus_*` (e.g. `directus_fields`, `directus_relations`, `directus_collections`, `directus_permissions`). All system metadata must be managed through Directus's validated Admin UI controls.

7. **Reason for Strictness:**
   - `https://gabay.zyberlab.com` is a live, shared production system actively used by multiple developers and teams.
   - Directus contains an unhandled exception bug in its Knex/database layer when foreign key relationship DDL (`/relations`, `/fields`) is called via REST. This crashes the server process and takes down the entire system (`HTTP 502 Bad Gateway`).
   - Using the Directus Admin UI purely through interactive mouse and keyboard events ensures Directus's internal UI validation handlers run properly without crashing the server.

8. **Client App Data Operations:**
   - Frontend and local server code may only read/write regular application items (`/items/:collection`) for normal LMS operations once authorized. No DDL or schema alterations are permitted via code or console under any circumstance.

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
