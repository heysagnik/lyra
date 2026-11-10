import { describe, it, expect } from "vitest";
import { authClient, signIn, signUp, signOut, useSession } from "./client";

describe("Better Auth Client", () => {
  it("exports auth client with auth helper methods", () => {
    expect(authClient).toBeDefined();
    expect(signIn).toBeDefined();
    expect(signUp).toBeDefined();
    expect(signOut).toBeDefined();
    expect(useSession).toBeDefined();
  });
});
