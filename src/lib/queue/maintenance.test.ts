import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/queries/usage", () => ({
  rollupDailyUsage: vi.fn().mockResolvedValue(undefined),
  pruneOldUsageEvents: vi.fn().mockResolvedValue(7),
  recordJobFailure: vi.fn().mockResolvedValue({ id: 1 }),
}));

import {
  runUsageMaintenance,
  executeUsageMaintenanceTask,
  setUsageMaintenanceForTesting,
} from "./maintenance";
import {
  rollupDailyUsage,
  pruneOldUsageEvents,
  recordJobFailure,
} from "@/lib/db/queries/usage";

describe("usage maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUsageMaintenanceForTesting(null);
  });

  it("rolls up yesterday and today, then prunes old events", async () => {
    const now = new Date("2026-11-14T00:00:05.000Z");
    const result = await runUsageMaintenance(now);

    expect(result.rolledUp).toEqual(["2026-11-13", "2026-11-14"]);
    expect(result.pruned).toBe(7);
    expect(rollupDailyUsage).toHaveBeenCalledTimes(2);
    expect(rollupDailyUsage).toHaveBeenNthCalledWith(1, "2026-11-13");
    expect(rollupDailyUsage).toHaveBeenNthCalledWith(2, "2026-11-14");
    expect(pruneOldUsageEvents).toHaveBeenCalledWith(90);
  });

  it("handles the UTC month boundary", async () => {
    const now = new Date("2026-12-01T00:00:10.000Z");
    const result = await runUsageMaintenance(now);
    expect(result.rolledUp).toEqual(["2026-11-30", "2026-12-01"]);
  });

  it("records a job failure when the task throws", async () => {
    setUsageMaintenanceForTesting({
      run: vi.fn().mockRejectedValue(new Error("rollup boom")),
    });

    await executeUsageMaintenanceTask();

    expect(recordJobFailure).toHaveBeenCalledTimes(1);
    expect(recordJobFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "usage_maintenance",
        error: "rollup boom",
      })
    );
  });
});
