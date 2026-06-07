import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const KEY_FILE = "app.key";
const VAULT_FILE = "vault.enc";
const ALGORITHM = "aes-256-gcm";

async function ensureDir(dataDir) {
  await fs.mkdir(dataDir, { recursive: true });
}

async function loadKey(dataDir) {
  await ensureDir(dataDir);
  const keyPath = path.join(dataDir, KEY_FILE);

  try {
    const encoded = await fs.readFile(keyPath, "utf8");
    return Buffer.from(encoded, "base64url");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const key = crypto.randomBytes(32);
    await fs.writeFile(keyPath, key.toString("base64url"), { mode: 0o600 });
    return key;
  }
}

async function readVault(dataDir, key) {
  const vaultPath = path.join(dataDir, VAULT_FILE);

  try {
    const raw = await fs.readFile(vaultPath, "utf8");
    const envelope = JSON.parse(raw);
    const iv = Buffer.from(envelope.iv, "base64url");
    const tag = Buffer.from(envelope.tag, "base64url");
    const encrypted = Buffer.from(envelope.data, "base64url");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeVault(dataDir, key, secrets) {
  await ensureDir(dataDir);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(secrets), "utf8"),
    cipher.final()
  ]);
  const envelope = {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url")
  };

  await fs.writeFile(
    path.join(dataDir, VAULT_FILE),
    `${JSON.stringify(envelope, null, 2)}\n`,
    { mode: 0o600 }
  );
}

export function createVault(dataDir) {
  async function withVault(mutator) {
    const key = await loadKey(dataDir);
    const secrets = await readVault(dataDir, key);
    const result = await mutator(secrets);
    await writeVault(dataDir, key, secrets);
    return result;
  }

  return {
    async setSecret(id, value) {
      await withVault((secrets) => {
        secrets[id] = value;
      });
    },

    async getSecret(id) {
      const key = await loadKey(dataDir);
      const secrets = await readVault(dataDir, key);
      return secrets[id] ?? null;
    },

    async deleteSecret(id) {
      await withVault((secrets) => {
        delete secrets[id];
      });
    },

    async clear() {
      await withVault((secrets) => {
        for (const id of Object.keys(secrets)) {
          delete secrets[id];
        }
      });
    }
  };
}
