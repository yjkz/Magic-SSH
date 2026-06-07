import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import { createVault } from "../server/services/vault.js";

let tempRoot;
let app;
let vault;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "magic-ssh-connections-"));
  ({ app } = createApp({ token: "secret-token", dataDir: tempRoot }));
  vault = createVault(tempRoot);
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function authed(client) {
  return client.set("x-magic-ssh-token", "secret-token");
}

describe("connection APIs", () => {
  it("creates and lists a password connection without leaking the password", async () => {
    const createResponse = await authed(request(app).post("/api/connections")).send({
      name: "生产服务器",
      host: "192.168.1.10",
      port: 22,
      username: "root",
      authType: "password",
      password: "server-password"
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.password).toBeUndefined();
    expect(createResponse.body).toMatchObject({
      name: "生产服务器",
      host: "192.168.1.10",
      port: 22,
      username: "root",
      authType: "password"
    });

    const storedSecret = await vault.getSecret(createResponse.body.credentialId);
    expect(storedSecret).toEqual({
      type: "password",
      password: "server-password"
    });

    const listResponse = await authed(request(app).get("/api/connections"));
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].password).toBeUndefined();
  });

  it("creates a private key connection and keeps key material in the vault", async () => {
    const response = await authed(request(app).post("/api/connections")).send({
      name: "密钥服务器",
      host: "example.com",
      port: 2222,
      username: "deploy",
      authType: "privateKey",
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----",
      passphrase: "key-passphrase"
    });

    expect(response.status).toBe(201);
    expect(response.body.privateKey).toBeUndefined();
    expect(response.body.passphrase).toBeUndefined();

    const storedSecret = await vault.getSecret(response.body.credentialId);
    expect(storedSecret).toEqual({
      type: "privateKey",
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----",
      passphrase: "key-passphrase"
    });
  });

  it("updates connection metadata and replaces credentials when provided", async () => {
    const created = await authed(request(app).post("/api/connections")).send({
      name: "旧连接",
      host: "old.example.com",
      port: 22,
      username: "root",
      authType: "password",
      password: "old-password"
    });

    const updated = await authed(request(app).put(`/api/connections/${created.body.id}`)).send({
      name: "新连接",
      host: "new.example.com",
      port: 2200,
      username: "admin",
      authType: "password",
      password: "new-password"
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      name: "新连接",
      host: "new.example.com",
      port: 2200,
      username: "admin"
    });

    const storedSecret = await vault.getSecret(created.body.credentialId);
    expect(storedSecret).toEqual({
      type: "password",
      password: "new-password"
    });
  });

  it("deletes connection metadata and its vault secret", async () => {
    const created = await authed(request(app).post("/api/connections")).send({
      name: "临时连接",
      host: "temp.example.com",
      port: 22,
      username: "root",
      authType: "password",
      password: "temp-password"
    });

    const deleted = await authed(request(app).delete(`/api/connections/${created.body.id}`));
    const listed = await authed(request(app).get("/api/connections"));

    expect(deleted.status).toBe(204);
    expect(listed.body).toEqual([]);
    expect(await vault.getSecret(created.body.credentialId)).toBeNull();
  });
});
