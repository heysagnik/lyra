import { describe, it, expect } from "vitest";
import { getAuth } from "./index";

describe("Better Auth Instance", () => {
  it("initializes and caches better-auth instance", () => {
    const auth1 = getAuth();
    const auth2 = getAuth();
    expect(auth1).toBeDefined();
    expect(auth1).toBe(auth2);
  });
});
