import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("/api/health endpoint", () => {
  it("returns ok: true and healthy status", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("healthy");
    expect(data.timestamp).toBeDefined();
  });
});
