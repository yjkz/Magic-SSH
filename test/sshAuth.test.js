import { describe, expect, it } from "vitest";
import { createSshAuthConfig } from "../server/services/sshAuth.js";

function vaultWith(secret) {
  return {
    async getSecret(id) {
      return id === "cred-1" ? secret : null;
    }
  };
}

describe("SSH auth config", () => {
  it("builds ssh2 password config from connection metadata and vault secret", async () => {
    const connection = {
      host: "192.168.1.10",
      port: 22,
      username: "root",
      authType: "password",
      credentialId: "cred-1"
    };

    const config = await createSshAuthConfig(connection, vaultWith({
      type: "password",
      password: "server-password"
    }));

    expect(config).toEqual({
      host: "192.168.1.10",
      port: 22,
      username: "root",
      readyTimeout: 15000,
      keepaliveInterval: 10000,
      password: "server-password"
    });
    expect(config.credentialId).toBeUndefined();
  });

  it("builds ssh2 private key config with optional passphrase", async () => {
    const connection = {
      host: "example.com",
      port: 2222,
      username: "deploy",
      authType: "privateKey",
      credentialId: "cred-1"
    };

    const config = await createSshAuthConfig(connection, vaultWith({
      type: "privateKey",
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----",
      passphrase: "key-passphrase"
    }));

    expect(config).toEqual({
      host: "example.com",
      port: 2222,
      username: "deploy",
      readyTimeout: 15000,
      keepaliveInterval: 10000,
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----",
      passphrase: "key-passphrase"
    });
  });

  it("throws a Chinese error when credentials are missing", async () => {
    await expect(createSshAuthConfig({
      host: "example.com",
      port: 22,
      username: "root",
      authType: "password",
      credentialId: "missing"
    }, vaultWith({ password: "unused" }))).rejects.toThrow("未找到连接凭据");
  });
});
