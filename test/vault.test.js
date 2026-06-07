import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createVault } from "../server/services/vault.js";

let tempRoot;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "magic-ssh-vault-"));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("encrypted vault", () => {
  it("creates app.key and vault.enc inside the supplied data directory", async () => {
    const vault = createVault(tempRoot);

    await vault.setSecret("cred-1", { password: "secret-password" });

    const keyStat = await fs.stat(path.join(tempRoot, "app.key"));
    const vaultStat = await fs.stat(path.join(tempRoot, "vault.enc"));

    expect(keyStat.isFile()).toBe(true);
    expect(vaultStat.isFile()).toBe(true);
  });

  it("round-trips secrets without storing plaintext", async () => {
    const vault = createVault(tempRoot);

    await vault.setSecret("cred-1", {
      type: "password",
      password: "super-secret-password"
    });

    const stored = await fs.readFile(path.join(tempRoot, "vault.enc"), "utf8");
    const loaded = await vault.getSecret("cred-1");

    expect(loaded).toEqual({
      type: "password",
      password: "super-secret-password"
    });
    expect(stored).not.toContain("super-secret-password");
    expect(stored).not.toContain("cred-1");
  });

  it("deletes one secret without removing the rest", async () => {
    const vault = createVault(tempRoot);

    await vault.setSecret("cred-1", { password: "first" });
    await vault.setSecret("cred-2", { password: "second" });
    await vault.deleteSecret("cred-1");

    expect(await vault.getSecret("cred-1")).toBeNull();
    expect(await vault.getSecret("cred-2")).toEqual({ password: "second" });
  });

  it("clears all stored secrets", async () => {
    const vault = createVault(tempRoot);

    await vault.setSecret("cred-1", { password: "first" });
    await vault.setSecret("cred-2", { password: "second" });
    await vault.clear();

    expect(await vault.getSecret("cred-1")).toBeNull();
    expect(await vault.getSecret("cred-2")).toBeNull();
  });
});
