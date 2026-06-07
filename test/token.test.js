import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createRuntimeToken,
  createTokenGuard,
  getTokenFromRequest
} from "../server/services/token.js";
import { createApp } from "../server/app.js";

describe("runtime token", () => {
  it("creates long random URL-safe tokens", () => {
    const first = createRuntimeToken();
    const second = createRuntimeToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(second).not.toBe(first);
  });

  it("reads token from query, custom header, or bearer authorization", () => {
    const queryRequest = { query: { token: "from-query" }, headers: {} };
    const headerRequest = { query: {}, headers: { "x-magic-ssh-token": "from-header" } };
    const bearerRequest = { query: {}, headers: { authorization: "Bearer from-bearer" } };

    expect(getTokenFromRequest(queryRequest)).toBe("from-query");
    expect(getTokenFromRequest(headerRequest)).toBe("from-header");
    expect(getTokenFromRequest(bearerRequest)).toBe("from-bearer");
  });

  it("rejects API requests without the startup token", async () => {
    const { app } = createApp({ token: "secret-token", dataDir: "test-data" });

    const missing = await request(app).get("/api/health");
    const invalid = await request(app).get("/api/health?token=wrong");

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it("accepts token through query or header", async () => {
    const { app } = createApp({ token: "secret-token", dataDir: "test-data" });

    const fromQuery = await request(app).get("/api/health?token=secret-token");
    const fromHeader = await request(app)
      .get("/api/health")
      .set("x-magic-ssh-token", "secret-token");

    expect(fromQuery.status).toBe(200);
    expect(fromHeader.status).toBe(200);
  });

  it("can guard a custom express router", async () => {
    const app = express();
    app.use(createTokenGuard("secret-token"));
    app.get("/guarded", (_req, res) => res.json({ ok: true }));

    const rejected = await request(app).get("/guarded");
    const accepted = await request(app).get("/guarded?token=secret-token");

    expect(rejected.status).toBe(401);
    expect(accepted.body).toEqual({ ok: true });
  });
});
