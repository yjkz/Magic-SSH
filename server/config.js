import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfiguredPort, resolveListenHostFromEnv, shouldOpenBrowser } from "./startup.js";

const __filename = fileURLToPath(import.meta.url);
const serverDir = path.dirname(__filename);
const rootDir = path.resolve(serverDir, "..");

export const config = {
  rootDir,
  defaultHost: resolveListenHostFromEnv(process.env.LISTEN_HOST) ?? "127.0.0.1",
  defaultPort: getConfiguredPort(process.env.PORT, 8765),
  dataDir: path.join(rootDir, "data"),
  shouldOpenBrowser: shouldOpenBrowser(process.env.DISABLE_OPEN_BROWSER)
};
