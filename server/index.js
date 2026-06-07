import http from "node:http";
import path from "node:path";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { createRuntimeToken } from "./services/token.js";
import {
  LAN_WARNING,
  askListenHost,
  formatAccessUrls,
  getLanAddresses,
  listenWithPortFallback,
  openBrowser
} from "./startup.js";
import { attachTerminalWebSocket } from "./ws/terminal.js";

const token = createRuntimeToken();
const host = await askListenHost();
const staticDir = path.join(config.rootDir, "dist");
const { app, connectionStore, vault, sshService } = createApp({
  token,
  dataDir: config.dataDir,
  staticDir
});
const server = http.createServer(app);

const listenResult = await listenWithPortFallback(server, {
  host,
  preferredPort: config.defaultPort
});

attachTerminalWebSocket({
  server,
  token,
  store: connectionStore,
  vault,
  sshService
});

{
  const urls = formatAccessUrls({
    host,
    port: listenResult.port,
    token,
    lanAddresses: getLanAddresses()
  });

  if (host === "0.0.0.0") {
    console.log(LAN_WARNING);
  }

  console.log("Magic SSH started:");
  for (const url of urls) {
    console.log(`- ${url}`);
  }
  console.log(`数据目录：${config.dataDir}`);
  openBrowser(urls[0]);
}
