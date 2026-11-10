import { describe, it, expect, vi } from "vitest";
import { ok, err, makeAppError, logStructuredError } from "./errors";

describe("Result and AppError", () => {
  it("creates successful Result with ok()", () => {
    const res = ok(42);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBe(42);
    }
  });

  it("creates failure Result with err()", () => {
    const error = makeAppError("RATE_LIMITED", "Too many requests", {
      retryAfter: 30,
    });
    const res = err(error);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("RATE_LIMITED");
      expect(res.error.message).toBe("Too many requests");
      expect(res.error.retryAfter).toBe(30);
    }
  });

  it("logs structured error context as JSON", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logStructuredError({
      userId: "u1",
      code: "INTERNAL",
      msg: "Test error log",
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
