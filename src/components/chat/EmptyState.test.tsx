import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

vi.mock("@/lib/auth/client", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "@/lib/auth/client";

describe("EmptyState Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a 2-liner empty state with greeting and subtitle", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { name: "Alex" } },
    } as ReturnType<typeof useSession>);

    render(<EmptyState />);

    // Line 1: Heading with greeting and name
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toContain("Alex");

    // Line 2: Subtitle prompt
    const subtitle = screen.getByText(/How can I help you/i);
    expect(subtitle).toBeDefined();
    expect(subtitle.tagName.toLowerCase()).toBe("p");
  });

  it("renders without user name when session is empty", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
    } as ReturnType<typeof useSession>);

    render(<EmptyState />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeDefined();
    const subtitle = screen.getByText(/How can I help you/i);
    expect(subtitle).toBeDefined();
  });

  it("updates document.title on mount", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
    } as ReturnType<typeof useSession>);

    render(<EmptyState />);
    expect(document.title).toBe("lyra — chat agent");
  });
});
