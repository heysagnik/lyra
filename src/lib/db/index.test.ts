import { describe, it, expect, vi } from "vitest";
import { getDb, pingDb } from "./index";

describe("Database Client Instance", () => {
  it("initializes and caches database client", () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBeDefined();
    expect(db1).toBe(db2);
  });

  it("pings database successfully", async () => {
    const db = getDb();
    vi.spyOn(db, "execute").mockResolvedValueOnce([] as unknown as never);
    const result = await pingDb();
    expect(result).toBe(true);
  });

  it("returns false when ping fails", async () => {
    const db = getDb();
    vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("Connection refused"));
    const result = await pingDb();
    expect(result).toBe(false);
  });
});

