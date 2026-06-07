import { Client } from "ssh2";
import path from "node:path";
import { pipeline } from "node:stream/promises";

function connect(config) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;

    function fail(error) {
      if (settled) {
        return;
      }

      settled = true;
      client.end();
      reject(error);
    }

    client
      .once("ready", () => {
        settled = true;
        resolve(client);
      })
      .once("error", fail)
      .connect(config);
  });
}

function openSftp(client) {
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(sftp);
    });
  });
}

async function withSftp(config, handler) {
  const client = await connect(config);

  try {
    const sftp = await openSftp(client);
    return await handler(sftp);
  } finally {
    client.end();
  }
}

function modeToPermissions(mode = 0) {
  return (mode & 0o777).toString(8).padStart(3, "0");
}

function entryType(attrs) {
  if (typeof attrs.isDirectory === "function" && attrs.isDirectory()) {
    return "directory";
  }

  if (typeof attrs.isFile === "function" && attrs.isFile()) {
    return "file";
  }

  return "other";
}

function normalizeEntry(item) {
  return {
    name: item.filename,
    type: entryType(item.attrs),
    size: item.attrs?.size ?? 0,
    modifiedAt: item.attrs?.mtime
      ? new Date(item.attrs.mtime * 1000).toISOString()
      : "",
    permissions: modeToPermissions(item.attrs?.mode)
  };
}

function shell(config, options) {
  return new Promise(async (resolve, reject) => {
    let client;

    try {
      client = await connect(config);
    } catch (error) {
      reject(error);
      return;
    }

    const shellOptions = {
      term: "xterm-256color",
      cols: options.cols ?? 80,
      rows: options.rows ?? 24
    };

    client.shell(shellOptions, (error, stream) => {
      if (error) {
        client.end();
        reject(error);
        return;
      }

      stream.on("data", (chunk) => {
        options.onData?.(chunk.toString("utf8"));
      });
      stream.on("close", () => {
        options.onClose?.();
        client.end();
      });
      stream.stderr?.on("data", (chunk) => {
        options.onData?.(chunk.toString("utf8"));
      });

      resolve({
        write(data) {
          stream.write(data);
        },
        resize(cols, rows) {
          stream.setWindow(rows, cols, 0, 0);
        },
        close() {
          stream.end();
          client.end();
        }
      });
    });
  });
}

export function createSshService() {
  return {
    async openShell(config, options) {
      return shell(config, options);
    },

    async listDirectory(config, remotePath) {
      return withSftp(config, async (sftp) => {
        const entries = await new Promise((resolve, reject) => {
          sftp.readdir(remotePath, (error, list) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(list.map(normalizeEntry));
          });
        });

        return { path: remotePath, entries };
      });
    },

    async uploadFile(config, remotePath, inputStream) {
      return withSftp(config, async (sftp) => {
        await pipeline(inputStream, sftp.createWriteStream(remotePath));
        return { ok: true };
      });
    },

    async downloadFile(config, remotePath) {
      return withSftp(config, async (sftp) => ({
        fileName: path.posix.basename(remotePath),
        stream: sftp.createReadStream(remotePath)
      }));
    }
  };
}
