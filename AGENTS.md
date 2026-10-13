# Gabay LMS Prototype - Agent Guidelines & Constraints

## 🚨 MANDATORY DIRECTIVE: LIKHA ERP BACKEND MODIFICATIONS

**DO NOT USE THE DIRECTUS / REST API TO MODIFY THE LIKHA ERP BACKEND.**

1. **Browser Subagent Only for ERP Backend Modifications:**
   - Whenever you need to alter, configure, or inspect Likha ERP data models, collections, fields, relations, interfaces, or system settings, you **MUST use the browser subagent (`browser_subagent`)** navigating `https://gabay.zyberlab.com/admin`.
   - Never use curl, Node.js scripts, or REST endpoints (`/fields`, `/relations`, `/collections`, etc.) for schema or backend modifications.
   - Reference: [Browser Subagent Documentation](https://antigravity.google/docs/ide/browser/)

2. **Reason:**
   - `https://gabay.zyberlab.com` is a live, shared production system actively used by multiple developers and teams.
   - Scripted REST API DDL calls (`/fields`, `/relations`) trigger uncaught exceptions in Directus that crash the host's `nodemon` process and cause an outage (HTTP 502 Bad Gateway) for all users.
   - Using the Directus Admin UI via `browser_subagent` ensures safe, validated, interactive operations without server crashes.

3. **Client App Data Operations:**
   - Frontend and local server code may only read/write regular application items (`/items/:collection`) for normal LMS operations once authorized. No DDL or schema alterations are permitted via code.
