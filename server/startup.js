import { execFile } from "node:child_process";
import os from "node:os";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export const LAN_WARNING = [
  "警告：0.0.0.0 会允许局域网设备访问本工具。",
  "请只在可信网络中使用，并妥善保管启动链接中的 token。"
].join("\n");

export function resolveListenHost(choice) {
  const normalized = String(choice ?? "").trim();

  if (normalized === "2" || normalized === "0.0.0.0") {
    return "0.0.0.0";
  }

  return "127.0.0.1";
}

export function getLanAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

export function formatAccessUrls({ host, port, token, lanAddresses = [] }) {
  const encodedToken = encodeURIComponent(token);
  const urls = [`http://127.0.0.1:${port}/?token=${encodedToken}`];

  if (host === "0.0.0.0") {
    for (const address of lanAddresses) {
      urls.push(`http://${address}:${port}/?token=${encodedToken}`);
    }
  }

  return urls;
}

export async function askListenHost() {
  if (!process.stdin.isTTY) {
    return "127.0.0.1";
  }

  const rl = readline.createInterface({ input, output });

  try {
    const choice = await rl.question([
      "请选择监听地址：",
      "1. 127.0.0.1 仅本机访问（推荐）",
      "2. 0.0.0.0 局域网访问（谨慎）",
      "直接回车默认选择 1："
    ].join("\n"));

    return resolveListenHost(choice);
  } finally {
    rl.close();
  }
}

export function openBrowser(url) {
  const command = process.platform === "win32"
    ? "cmd"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const args = process.platform === "win32"
    ? ["/c", "start", "", url]
    : [url];

  const child = execFile(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });

  child.unref();
}

export async function listenWithPortFallback(server, {
  host,
  preferredPort,
  maxAttempts = 20
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = preferredPort + attempt;
    const result = await new Promise((resolve, reject) => {
      function cleanup() {
        server.off("error", onError);
        server.off("listening", onListening);
      }

      function onListening() {
        cleanup();
        resolve({ port });
      }

      function onError(error) {
        cleanup();
        if (error.code === "EADDRINUSE") {
          resolve({ busy: true });
          return;
        }

        reject(error);
      }

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, host);
    });

    if (!result.busy) {
      return { host, port: result.port };
    }
  }

  throw new Error(`端口 ${preferredPort}-${preferredPort + maxAttempts - 1} 均被占用`);
}
