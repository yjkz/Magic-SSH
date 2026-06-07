import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const serverDir = path.dirname(__filename);
const rootDir = path.resolve(serverDir, "..");

export const config = {
  rootDir,
  defaultHost: "127.0.0.1",
  defaultPort: 8765,
  dataDir: path.join(rootDir, "data")
};
