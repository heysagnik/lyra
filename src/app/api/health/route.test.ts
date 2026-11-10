import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";
import * as dbModule from "@/lib/db";
import * as usageQueries from "@/lib/db/queries/usage";

describe("/api/health endpoint", () => {
  it("returns ok: true and healthy status when DB is available", async () => {
    vi.spyOn(dbModule, "pingDb").mockResolvedValue(true);
    vi.spyOn(usageQueries, "countJobFailures").mockResolvedValue(0);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("healthy");
    expect(data.db).toBe(true);
    expect(data.recentFailures24h).toBe(0);
    expect(data.timestamp).toBeDefined();
  });
});
