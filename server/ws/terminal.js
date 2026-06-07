import { WebSocketServer } from "ws";
import { createSshAuthConfig } from "../services/sshAuth.js";

function sendJson(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

export function attachTerminalWebSocket({ server, token, store, vault, sshService }) {
  const wss = new WebSocketServer({ server, path: "/ws/terminal" });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let shellSession = null;

    if (url.searchParams.get("token") !== token) {
      sendJson(socket, { type: "error", message: "token 无效或已缺失" });
      socket.close(1008, "invalid token");
      return;
    }

    socket.on("message", async (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.type === "connect") {
          const connection = await store.get(message.connectionId);

          if (!connection) {
            sendJson(socket, { type: "error", message: "连接不存在" });
            return;
          }

          const config = await createSshAuthConfig(connection, vault);
          shellSession = await sshService.openShell(config, {
            cols: message.cols,
            rows: message.rows,
            onData(data) {
              sendJson(socket, { type: "data", data });
            },
            onClose() {
              sendJson(socket, { type: "status", status: "closed" });
            }
          });
          sendJson(socket, { type: "status", status: "connected" });
          return;
        }

        if (message.type === "data" && shellSession) {
          shellSession.write(message.data);
          return;
        }

        if (message.type === "resize" && shellSession) {
          shellSession.resize(message.cols, message.rows);
          return;
        }

        if (message.type === "disconnect" && shellSession) {
          shellSession.close();
          shellSession = null;
          sendJson(socket, { type: "status", status: "closed" });
        }
      } catch (error) {
        sendJson(socket, {
          type: "error",
          message: error.message || "终端连接失败"
        });
      }
    });

    socket.on("close", () => {
      shellSession?.close();
      shellSession = null;
    });
  });

  return wss;
}
