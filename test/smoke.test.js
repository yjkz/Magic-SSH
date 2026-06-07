import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";

describe("app factory", () => {
  it("exposes a health endpoint with Chinese service name", async () => {
    const { app } = createApp({ token: "test-token", dataDir: "test-data" });
    const request = (await import("supertest")).default;
    const response = await request(app).get("/api/health?token=test-token");

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Magic SSH");
  });
});
