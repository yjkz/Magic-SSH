/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";
import { rocomTerminalTheme } from "../src/terminalTheme.js";

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;

    dispose() {}
    loadAddon() {}
    onData() {
      return { dispose() {} };
    }
    open() {}
    write() {}
    writeln() {}
  }
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
  }
}));

afterEach(() => {
  cleanup();
});

describe("Magic SSH app", () => {
  it("renders the Rocom styled Chinese tab shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Magic SSH" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "连接管理" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "终端" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "远程文件" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "设置" })).toBeInTheDocument();
  });

  it("uses a parchment Rocom terminal instead of a dark terminal", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: "终端" }));

    expect(screen.getByText("羊皮纸终端")).toBeInTheDocument();
    expect(screen.queryByText("暗色终端")).not.toBeInTheDocument();
    expect(rocomTerminalTheme.background).toBe("#F4ECDC");
    expect(rocomTerminalTheme.foreground).toBe("#3D3528");
    expect(rocomTerminalTheme.cursorAccent).toBe("#FFFCF7");
    expect(rocomTerminalTheme.selectionForeground).toBe("#1A1510");
    expect(rocomTerminalTheme.black).not.toBe("#17120F");
  });
});
