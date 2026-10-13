# Rule: Likha ERP Backend Modifications & Schema Changes

## CRITICAL DIRECTIVE: DO NOT USE REST / DIRECTUS API FOR LIKHA BACKEND MODIFICATIONS

Whenever modifying the **Likha ERP backend** (including collections, fields, relations, schema, flows, or administration settings), you **MUST NOT** use the Directus REST API, curl, `fetch()`, or backend automation scripts.

### 1. Mandatory Use of Browser Subagent
All backend modifications, schema adjustments, field reconfigurations, relationship setups, and Directus settings **MUST BE CONDUCTED EXCLUSIVELY VIA THE BROWSER SUBAGENT (`browser_subagent`)**:
- Target URL: `https://gabay.zyberlab.com/admin`
- The agent must use the interactive Directus Admin UI in the browser, configuring fields, relations, interfaces, and permissions through the visual user interface just like a human administrator.
- Reference: [Browser Subagent Documentation](https://antigravity.google/docs/ide/browser/)

### 2. Context & Root Cause
- Likha ERP is a **live, shared multi-developer deployment** hosted under `nodemon` on the origin server.
- Programmatic REST API calls altering schema (`/fields`, `/relations`, `/collections`, DDL drops) can trigger unhandled Knex/schema reconciliation exceptions inside Directus, crashing the `nodemon` process into an unresponsive state and returning Cloudflare 502 Bad Gateway to all developers.
- Directus's Admin UI performs comprehensive form-level and transaction-level validations that ensure the backend process remains healthy and stable.

### 3. Summary of Prohibitions
- ❌ **NEVER** call `DELETE /fields/...` or `POST /fields/...` via REST.
- ❌ **NEVER** call `POST /relations` or `PATCH /relations/...` via REST.
- ❌ **NEVER** run migration scripts or CLI scripts that execute DDL on `https://gabay.zyberlab.com`.
- ✅ **ALWAYS** use `browser_subagent` to log into `https://gabay.zyberlab.com/admin` and perform modifications directly within the Admin UI.
