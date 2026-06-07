import express from "express";

function toPort(value) {
  const port = Number(value ?? 22);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 22;
}

function connectionInput(body) {
  return {
    name: String(body.name ?? "").trim(),
    host: String(body.host ?? "").trim(),
    port: toPort(body.port),
    username: String(body.username ?? "").trim(),
    authType: body.authType === "privateKey" ? "privateKey" : "password"
  };
}

function validateConnection(input) {
  if (!input.name || !input.host || !input.username) {
    return "连接名称、主机和用户名不能为空";
  }

  return "";
}

function secretFromBody(body, authType) {
  if (authType === "privateKey") {
    return {
      type: "privateKey",
      privateKey: String(body.privateKey ?? ""),
      passphrase: body.passphrase ? String(body.passphrase) : ""
    };
  }

  return {
    type: "password",
    password: String(body.password ?? "")
  };
}

function hasSecretPayload(body, authType) {
  if (authType === "privateKey") {
    return typeof body.privateKey === "string" && body.privateKey.length > 0;
  }

  return typeof body.password === "string" && body.password.length > 0;
}

export function createConnectionsRouter({ store, vault }) {
  const router = express.Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await store.list());
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const input = connectionInput(req.body);
      const validationError = validateConnection(input);

      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      if (!hasSecretPayload(req.body, input.authType)) {
        res.status(400).json({ error: "认证凭据不能为空" });
        return;
      }

      const connection = await store.create(input);
      await vault.setSecret(connection.credentialId, secretFromBody(req.body, input.authType));
      res.status(201).json(connection);
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const input = connectionInput(req.body);
      const validationError = validateConnection(input);

      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const connection = await store.update(req.params.id, input);

      if (!connection) {
        res.status(404).json({ error: "连接不存在" });
        return;
      }

      if (hasSecretPayload(req.body, input.authType)) {
        await vault.setSecret(connection.credentialId, secretFromBody(req.body, input.authType));
      }

      res.json(connection);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const deleted = await store.delete(req.params.id);

      if (!deleted) {
        res.status(404).json({ error: "连接不存在" });
        return;
      }

      await vault.deleteSecret(deleted.credentialId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
