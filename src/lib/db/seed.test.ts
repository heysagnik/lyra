import { describe, it, expect, vi } from "vitest";
import * as dbModule from "@/lib/db";
import { seedDevData } from "./seed";

describe("Database Dev Seed", () => {
  it("runs dev seed operations cleanly", async () => {
    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      returning: vi.fn().mockResolvedValue([
        { id: "00000000-0000-0000-0000-000000000099" },
      ]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      insert: () => mockInsert,
    } as unknown as dbModule.DbClient);

    const result = await seedDevData();
    expect(result.success).toBe(true);
    expect(result.userId).toBe("00000000-0000-0000-0000-000000000001");
  });
});
