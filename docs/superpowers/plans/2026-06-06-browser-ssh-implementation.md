# Browser SSH Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal browser-based SSH tool with saved encrypted credentials, a Rocom Grimoire Chinese UI, terminal access, and remote SFTP upload/download.

**Architecture:** A Node.js Express server runs locally, serves a Vite React frontend, exposes token-protected HTTP APIs, and bridges xterm.js WebSocket traffic to ssh2 shell sessions. Credentials live in program-directory `data/` and are encrypted through a local AES-256-GCM vault.

**Tech Stack:** Node.js, Express, ws, ssh2, Vite, React, xterm.js, Vitest, Supertest.

---

## File Structure

- `package.json`: scripts and dependencies for server, frontend, build, and tests.
- `index.html`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`: Vite React app and Rocom UI.
- `server/index.js`: startup prompt, token generation, Express/Vite hosting, WebSocket terminal setup.
- `server/app.js`: Express app factory for APIs and static/frontend middleware.
- `server/config.js`: paths, host/port defaults, runtime metadata.
- `server/services/token.js`: token generation and request validation.
- `server/services/vault.js`: AES-256-GCM encrypted credential vault.
- `server/services/connectionStore.js`: connection CRUD backed by `data/connections.json`.
- `server/services/sshAuth.js`: combines connection metadata and vault secrets into ssh2 config.
- `server/services/sshService.js`: SSH shell and SFTP helper functions.
- `server/routes/connections.js`: connection CRUD and connect validation APIs.
- `server/routes/files.js`: SFTP file list, upload, and download APIs.
- `server/ws/terminal.js`: WebSocket-to-SSH terminal bridge.
- `test/*.test.js`: unit and API tests.

## Task 1: Project Skeleton And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/styles.css`
- Create: `server/config.js`
- Create: `server/app.js`
- Create: `server/index.js`
- Create: `test/smoke.test.js`

- [ ] **Step 1: Write the failing smoke test**

Create `test/smoke.test.js` with:

```js
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";

describe("app factory", () => {
  it("exposes a health endpoint with Chinese service name", async () => {
    const { app } = createApp({ token: "test-token", dataDir: "test-data" });
    const request = (await import("supertest")).default;
    const response = await request(app).get("/api/health?token=test-token");

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("魔法 SSH");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/smoke.test.js`

Expected: FAIL because `package.json` and `server/app.js` do not exist yet.

- [ ] **Step 3: Add the minimal app skeleton**

Create the package, Express app, basic frontend, and health endpoint.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/smoke.test.js`

Expected: PASS.

## Task 2: Token Guard

**Files:**
- Create: `server/services/token.js`
- Test: `test/token.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: Write token tests**

Test that a token is random, accepted through query/header, and rejected when missing.

- [ ] **Step 2: Run token tests to verify failure**

Run: `npm test -- test/token.test.js`

Expected: FAIL because token service does not exist.

- [ ] **Step 3: Implement token service and middleware**

Implement `createRuntimeToken()`, `getTokenFromRequest()`, and `createTokenGuard(token)`.

- [ ] **Step 4: Run token tests and smoke test**

Run: `npm test -- test/token.test.js test/smoke.test.js`

Expected: PASS.

## Task 3: Encrypted Vault

**Files:**
- Create: `server/services/vault.js`
- Test: `test/vault.test.js`

- [ ] **Step 1: Write vault tests**

Cover key creation in a supplied data directory, encrypted save/load, non-plaintext storage, and delete.

- [ ] **Step 2: Run vault tests to verify failure**

Run: `npm test -- test/vault.test.js`

Expected: FAIL because vault service does not exist.

- [ ] **Step 3: Implement AES-256-GCM vault**

Use `crypto.randomBytes(32)` for `app.key`, store JSON payloads in `vault.enc`, and expose `setSecret`, `getSecret`, `deleteSecret`, and `clear`.

- [ ] **Step 4: Run vault tests**

Run: `npm test -- test/vault.test.js`

Expected: PASS.

## Task 4: Connection Store And APIs

**Files:**
- Create: `server/services/connectionStore.js`
- Create: `server/routes/connections.js`
- Test: `test/connections.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: Write connection API tests**

Cover create/list/update/delete for password and private-key connections. Assert secrets are saved to vault and never returned by list/get responses.

- [ ] **Step 2: Run connection tests to verify failure**

Run: `npm test -- test/connections.test.js`

Expected: FAIL because routes and store do not exist.

- [ ] **Step 3: Implement store and routes**

Persist non-sensitive connection metadata to `connections.json`, store sensitive fields in vault by credentialId, and delete vault credentials when deleting a connection.

- [ ] **Step 4: Run connection tests**

Run: `npm test -- test/connections.test.js`

Expected: PASS.

## Task 5: SSH Auth, Terminal, And SFTP APIs

**Files:**
- Create: `server/services/sshAuth.js`
- Create: `server/services/sshService.js`
- Create: `server/routes/files.js`
- Create: `server/ws/terminal.js`
- Test: `test/sshAuth.test.js`
- Modify: `server/app.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write SSH auth tests**

Verify password and private-key credential payloads become valid ssh2 connection config and never expose vault internals.

- [ ] **Step 2: Run SSH auth tests to verify failure**

Run: `npm test -- test/sshAuth.test.js`

Expected: FAIL because SSH auth service does not exist.

- [ ] **Step 3: Implement SSH auth and service boundaries**

Implement auth config creation, shell channel setup, SFTP list/upload/download helpers, and WebSocket terminal bridge.

- [ ] **Step 4: Run unit tests**

Run: `npm test -- test/sshAuth.test.js`

Expected: PASS.

Manual SSH/SFTP verification requires a real target server and is covered in final verification.

## Task 6: Rocom Grimoire Frontend

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/main.jsx`

- [ ] **Step 1: Implement API client and state**

Create frontend state for token, connections, active connection, terminal state, file path, file list, transfer progress, and errors.

- [ ] **Step 2: Implement Chinese Tab UI**

Build tabs: `连接管理`, `终端`, `远程文件`, `设置`.

- [ ] **Step 3: Implement terminal view**

Use xterm.js and xterm-addon-fit. Apply the Rocom dark terminal theme from the design spec.

- [ ] **Step 4: Implement remote file view**

List remote files, navigate folders, upload one file, download one file, and display progress/status.

- [ ] **Step 5: Implement Rocom styling**

Use warm parchment backgrounds, paper surfaces, gold active states, rounded 8-12px panels, Chinese round font stack, and a dark fantasy terminal surface.

- [ ] **Step 6: Run frontend build**

Run: `npm run build`

Expected: PASS.

## Task 7: Startup Flow And Verification

**Files:**
- Modify: `server/index.js`
- Create: `start.bat`

- [ ] **Step 1: Implement startup prompt**

Prompt for `127.0.0.1` or `0.0.0.0`, default to `127.0.0.1`, print the warning for `0.0.0.0`, generate token, start server, and open the browser URL.

- [ ] **Step 2: Run automated verification**

Run:

```powershell
npm test
npm run build
```

Expected: both exit 0.

- [ ] **Step 3: Run local manual verification**

Run: `npm run dev`

Expected: command line offers the listen-address choice, prints a tokenized local URL, and the browser UI opens.

- [ ] **Step 4: Verify acceptance checklist**

Check the design spec acceptance list against the running app. Real SSH/SFTP behavior requires a reachable SSH target.

