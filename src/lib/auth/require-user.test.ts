import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireUser } from "./require-user";
import * as authIndex from "./index";

describe("requireUser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns AUTH error when no session is present", async () => {
    vi.spyOn(authIndex, "getAuth").mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ReturnType<typeof authIndex.getAuth>);

    const request = new Request("http://localhost:3000/api/chat", {
      headers: new Headers(),
    });

    const result = await requireUser(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH");
      expect(result.error.message).toContain("Unauthorized");
    }
  });

  it("returns user details when a valid session exists", async () => {
    vi.spyOn(authIndex, "getAuth").mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: {
            id: "user-123",
            email: "test@example.com",
            name: "Test User",
          },
        }),
      },
    } as unknown as ReturnType<typeof authIndex.getAuth>);

    const request = new Request("http://localhost:3000/api/chat", {
      headers: new Headers({ cookie: "better-auth.session_token=valid-token" }),
    });

    const result = await requireUser(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("user-123");
      expect(result.value.email).toBe("test@example.com");
      expect(result.value.name).toBe("Test User");
    }
  });
});
