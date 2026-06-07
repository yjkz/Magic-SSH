import Busboy from "busboy";
import express from "express";
import path from "node:path";
import { Readable } from "node:stream";
import { createSshAuthConfig } from "../services/sshAuth.js";

function remotePathFromQuery(req, fallback = ".") {
  const value = req.query.path;
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function safeRemoteFileName(fileName) {
  return path.posix.basename(String(fileName).replaceAll("\\", "/"));
}

function joinRemotePath(directory, fileName) {
  return path.posix.join(directory || ".", safeRemoteFileName(fileName));
}

async function resolveSshConfig(req, store, vault) {
  const connectionId = String(req.query.connectionId ?? "");
  const connection = await store.get(connectionId);

  if (!connection) {
    const error = new Error("连接不存在");
    error.statusCode = 404;
    throw error;
  }

  return createSshAuthConfig(connection, vault);
}

function firstUploadedFile(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    let found = false;

    busboy.on("file", (fieldName, file, info) => {
      if (fieldName !== "file" || found) {
        file.resume();
        return;
      }

      found = true;
      resolve({
        stream: file,
        fileName: info.filename
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => {
      if (!found) {
        const error = new Error("未选择上传文件");
        error.statusCode = 400;
        reject(error);
      }
    });

    req.pipe(busboy);
  });
}

function pipeDownload(stream, res) {
  if (stream?.pipe) {
    stream.pipe(res);
    return;
  }

  if (stream?.getReader) {
    Readable.fromWeb(stream).pipe(res);
    return;
  }

  Readable.from(stream ?? "").pipe(res);
}

export function createFilesRouter({ store, vault, sshService }) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const config = await resolveSshConfig(req, store, vault);
      const listing = await sshService.listDirectory(config, remotePathFromQuery(req, "."));
      res.json(listing);
    } catch (error) {
      next(error);
    }
  });

  router.post("/upload", async (req, res, next) => {
    try {
      const config = await resolveSshConfig(req, store, vault);
      const directory = remotePathFromQuery(req, ".");
      const uploaded = await firstUploadedFile(req);
      const remotePath = joinRemotePath(directory, uploaded.fileName);
      const result = await sshService.uploadFile(config, remotePath, uploaded.stream);

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/download", async (req, res, next) => {
    try {
      const config = await resolveSshConfig(req, store, vault);
      const remotePath = remotePathFromQuery(req, "");

      if (!remotePath) {
        res.status(400).json({ error: "远程路径不能为空" });
        return;
      }

      const { fileName, stream } = await sshService.downloadFile(config, remotePath);
      res.setHeader("content-type", "application/octet-stream");
      res.setHeader("content-disposition", `attachment; filename="${safeRemoteFileName(fileName)}"`);
      pipeDownload(stream, res);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
