import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const CONNECTIONS_FILE = "connections.json";

async function ensureDir(dataDir) {
  await fs.mkdir(dataDir, { recursive: true });
}

function filePath(dataDir) {
  return path.join(dataDir, CONNECTIONS_FILE);
}

async function readConnections(dataDir) {
  await ensureDir(dataDir);

  try {
    const raw = await fs.readFile(filePath(dataDir), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeConnections(dataDir, connections) {
  await ensureDir(dataDir);
  await fs.writeFile(
    filePath(dataDir),
    `${JSON.stringify(connections, null, 2)}\n`,
    "utf8"
  );
}

function nowIso() {
  return new Date().toISOString();
}

export function createConnectionStore(dataDir) {
  return {
    async list() {
      return readConnections(dataDir);
    },

    async get(id) {
      const connections = await readConnections(dataDir);
      return connections.find((connection) => connection.id === id) ?? null;
    },

    async create(input) {
      const connections = await readConnections(dataDir);
      const timestamp = nowIso();
      const connection = {
        id: crypto.randomUUID(),
        credentialId: crypto.randomUUID(),
        name: input.name,
        host: input.host,
        port: input.port,
        username: input.username,
        authType: input.authType,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      connections.push(connection);
      await writeConnections(dataDir, connections);
      return connection;
    },

    async update(id, input) {
      const connections = await readConnections(dataDir);
      const index = connections.findIndex((connection) => connection.id === id);

      if (index === -1) {
        return null;
      }

      const updated = {
        ...connections[index],
        name: input.name,
        host: input.host,
        port: input.port,
        username: input.username,
        authType: input.authType,
        updatedAt: nowIso()
      };

      connections[index] = updated;
      await writeConnections(dataDir, connections);
      return updated;
    },

    async delete(id) {
      const connections = await readConnections(dataDir);
      const target = connections.find((connection) => connection.id === id);

      if (!target) {
        return null;
      }

      await writeConnections(
        dataDir,
        connections.filter((connection) => connection.id !== id)
      );

      return target;
    }
  };
}
