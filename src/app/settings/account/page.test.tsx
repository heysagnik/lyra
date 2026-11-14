import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({
    data: {
      user: { name: "Sagnik", email: "sahoosagnik1@gmail.com", image: null },
    },
  }),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AccountPage from "./page";

const sessionsPayload = [
  {
    id: "s1",
    userAgent:
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36",
    createdAt: "2026-11-11T03:15:28.635Z",
  },
  {
    id: "s2",
    userAgent:
      "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Edg/158.0.0.0 Mobile Safari/537.36",
    createdAt: "2026-11-11T03:15:11.466Z",
  },
];

const accountsPayload = [{ providerId: "credential", id: "a1" }];

describe("Account settings — Manage devices", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("list-sessions")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(sessionsPayload),
          } as Response);
        }
        if (url.includes("list-accounts")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(accountsPayload),
          } as Response);
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve(null) } as Response);
      })
    );
  });

  it("shows device count and lists devices when expanded", async () => {
    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText("2 devices")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Manage devices"));

    expect(await screen.findByText("Chrome on Android")).toBeTruthy();
    expect(screen.getByText("Edge on Android")).toBeTruthy();
  });
});
