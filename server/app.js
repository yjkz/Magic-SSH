import express from "express";
import fs from "node:fs";
import path from "node:path";
import { createConnectionsRouter } from "./routes/connections.js";
import { createFilesRouter } from "./routes/files.js";
import { createConnectionStore } from "./services/connectionStore.js";
import { createSshService } from "./services/sshService.js";
import { createTokenGuard, getTokenFromRequest } from "./services/token.js";
import { createVault } from "./services/vault.js";

function requirePageToken(req, res, token) {
  if (getTokenFromRequest(req) !== token) {
    res.status(401).send("token 无效或已缺失");
    return false;
  }

  return true;
}

export function createApp(options = {}) {
  const token = options.token ?? "dev-token";
  const dataDir = options.dataDir;
  const vault = options.vault ?? createVault(dataDir);
  const connectionStore = options.connectionStore ?? createConnectionStore(dataDir);
  const sshService = options.sshService ?? createSshService();
  const staticDir = options.staticDir;
  const app = express();

  app.use((req, res, next) => {
    if (req.is("multipart/form-data")) {
      next();
      return;
    }

    express.json({ limit: "2mb" })(req, res, next);
  });
  app.use("/api", createTokenGuard(token));

  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });

  app.get("/api/health", (req, res) => {
    res.json({
      name: "Magic SSH",
      dataDir
    });
  });

  app.use("/api/connections", createConnectionsRouter({
    store: connectionStore,
    vault
  }));

  app.use("/api/files", createFilesRouter({
    store: connectionStore,
    vault,
    sshService
  }));

  if (staticDir && fs.existsSync(staticDir)) {
    const indexPath = path.join(staticDir, "index.html");

    app.get(["/", "/index.html"], (req, res) => {
      if (!requirePageToken(req, res, token)) {
        return;
      }

      res.sendFile(indexPath);
    });

    app.use(express.static(staticDir, { index: false }));

    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) {
        next();
        return;
      }

      if (!requirePageToken(req, res, token)) {
        return;
      }

      res.sendFile(indexPath);
    });
  }

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(error.statusCode ?? 500).json({
      error: error.statusCode ? error.message : "服务器内部错误"
    });
  });

  return {
    app,
    connectionStore,
    vault,
    sshService
  };
}
