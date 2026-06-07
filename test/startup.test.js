import { describe, expect, it } from "vitest";
import http from "node:http";
import {
  LAN_WARNING,
  getConfiguredPort,
  shouldOpenBrowser,
  formatAccessUrls,
  listenWithPortFallback,
  resolveListenHost,
  resolveListenHostFromEnv
} from "../server/startup.js";

describe("startup helpers", () => {
  it("defaults to localhost when the choice is empty or unknown", () => {
    expect(resolveListenHost("")).toBe("127.0.0.1");
    expect(resolveListenHost("anything")).toBe("127.0.0.1");
  });

  it("allows explicit LAN listening with 0.0.0.0", () => {
    expect(resolveListenHost("2")).toBe("0.0.0.0");
    expect(resolveListenHost("0.0.0.0")).toBe("0.0.0.0");
  });

  it("prefers an explicit environment host when provided", () => {
    expect(resolveListenHostFromEnv("0.0.0.0")).toBe("0.0.0.0");
    expect(resolveListenHostFromEnv("127.0.0.1")).toBe("127.0.0.1");
    expect(resolveListenHostFromEnv(" 2 ")).toBe("0.0.0.0");
  });

  it("ignores unknown environment host values", () => {
    expect(resolveListenHostFromEnv("")).toBeNull();
    expect(resolveListenHostFromEnv("anything")).toBeNull();
    expect(resolveListenHostFromEnv(undefined)).toBeNull();
  });

  it("uses the configured port from the environment when valid", () => {
    expect(getConfiguredPort("9000", 8765)).toBe(9000);
    expect(getConfiguredPort(" 2222 ", 8765)).toBe(2222);
  });

  it("falls back to the default port for invalid environment values", () => {
    expect(getConfiguredPort("", 8765)).toBe(8765);
    expect(getConfiguredPort("abc", 8765)).toBe(8765);
    expect(getConfiguredPort("0", 8765)).toBe(8765);
    expect(getConfiguredPort("70000", 8765)).toBe(8765);
  });

  it("can disable opening the browser from the environment", () => {
    expect(shouldOpenBrowser(undefined)).toBe(true);
    expect(shouldOpenBrowser("0")).toBe(true);
    expect(shouldOpenBrowser("1")).toBe(false);
    expect(shouldOpenBrowser("true")).toBe(false);
  });

  it("formats localhost and LAN URLs with token", () => {
    expect(formatAccessUrls({
      host: "127.0.0.1",
      port: 8765,
      token: "abc",
      lanAddresses: ["192.168.1.20"]
    })).toEqual(["http://127.0.0.1:8765/?token=abc"]);

    expect(formatAccessUrls({
      host: "0.0.0.0",
      port: 8765,
      token: "abc",
      lanAddresses: ["192.168.1.20", "10.0.0.8"]
    })).toEqual([
      "http://127.0.0.1:8765/?token=abc",
      "http://192.168.1.20:8765/?token=abc",
      "http://10.0.0.8:8765/?token=abc"
    ]);
  });

  it("contains the required LAN warning copy", () => {
    expect(LAN_WARNING).toContain("0.0.0.0 会允许局域网设备访问本工具");
    expect(LAN_WARNING).toContain("可信网络");
    expect(LAN_WARNING).toContain("token");
  });

  it("falls back to the next available port when the preferred port is busy", async () => {
    const occupiedServer = http.createServer((_req, res) => res.end("busy"));
    const appServer = http.createServer((_req, res) => res.end("ok"));

    await new Promise((resolve) => occupiedServer.listen(0, "127.0.0.1", resolve));
    const occupiedPort = occupiedServer.address().port;

    try {
      const result = await listenWithPortFallback(appServer, {
        host: "127.0.0.1",
        preferredPort: occupiedPort,
        maxAttempts: 20
      });

      expect(result.port).not.toBe(occupiedPort);
      expect(result.port).toBeGreaterThan(occupiedPort);
    } finally {
      await Promise.all([
        new Promise((resolve) => occupiedServer.close(resolve)),
        new Promise((resolve) => appServer.close(resolve))
      ]);
    }
  });
});
