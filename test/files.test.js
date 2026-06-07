import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../server/app.js";

let tempRoot;
let app;
let fakeSshService;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "magic-ssh-files-"));
  fakeSshService = {
    listDirectory: vi.fn(async (_config, remotePath) => ({
      path: remotePath,
      entries: [
        {
          name: "logs",
          type: "directory",
          size: 0,
          modifiedAt: "2026-06-06T12:00:00.000Z",
          permissions: "755"
        },
        {
          name: "app.log",
          type: "file",
          size: 128,
          modifiedAt: "2026-06-06T12:01:00.000Z",
          permissions: "644"
        }
      ]
    })),
    uploadFile: vi.fn(async () => ({ ok: true })),
    downloadFile: vi.fn(async (_config, remotePath) => ({
      fileName: path.posix.basename(remotePath),
      stream: ReadableStream.from(["hello"])
    }))
  };

  ({ app } = createApp({
    token: "secret-token",
    dataDir: tempRoot,
    sshService: fakeSshService
  }));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function createConnection() {
  const response = await request(app)
    .post("/api/connections")
    .set("x-magic-ssh-token", "secret-token")
    .send({
      name: "文件服务器",
      host: "example.com",
      port: 22,
      username: "root",
      authType: "password",
      password: "server-password"
    });

  return response.body;
}

function authed(client) {
  return client.set("x-magic-ssh-token", "secret-token");
}

describe("remote file APIs", () => {
  it("lists remote directory entries through SFTP service", async () => {
    const connection = await createConnection();

    const response = await authed(request(app).get("/api/files"))
      .query({ connectionId: connection.id, path: "/var/log" });

    expect(response.status).toBe(200);
    expect(response.body.path).toBe("/var/log");
    expect(response.body.entries).toHaveLength(2);
    expect(response.body.entries[0]).toMatchObject({
      name: "logs",
      type: "directory"
    });
    expect(fakeSshService.listDirectory).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "example.com",
        username: "root",
        password: "server-password"
      }),
      "/var/log"
    );
  });

  it("uploads one file to the selected remote directory", async () => {
    const connection = await createConnection();

    const response = await authed(request(app).post("/api/files/upload"))
      .query({ connectionId: connection.id, path: "/tmp" })
      .attach("file", Buffer.from("hello"), "note.txt");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(fakeSshService.uploadFile).toHaveBeenCalledWith(
      expect.any(Object),
      "/tmp/note.txt",
      expect.any(Object)
    );
  });

  it("downloads one remote file", async () => {
    const connection = await createConnection();

    const response = await authed(request(app).get("/api/files/download"))
      .query({ connectionId: connection.id, path: "/tmp/note.txt" });

    expect(response.status).toBe(200);
    expect(response.header["content-disposition"]).toContain("note.txt");
    expect(Buffer.from(response.body).toString("utf8")).toBe("hello");
  });
});
