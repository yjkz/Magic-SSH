import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";

let tempRoot;
let staticDir;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "magic-ssh-static-"));
  staticDir = path.join(tempRoot, "dist");
  await fs.mkdir(staticDir, { recursive: true });
  await fs.writeFile(path.join(staticDir, "index.html"), "<div id=\"root\"></div>", "utf8");
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("static page token guard", () => {
  it("rejects the app document without token and serves it with token", async () => {
    const { app } = createApp({
      token: "secret-token",
      dataDir: path.join(tempRoot, "data"),
      staticDir
    });

    const rejected = await request(app).get("/");
    const accepted = await request(app).get("/?token=secret-token");

    expect(rejected.status).toBe(401);
    expect(accepted.status).toBe(200);
    expect(accepted.text).toContain("root");
  });
});
