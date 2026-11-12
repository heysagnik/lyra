import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown Component & Security", () => {
  it("renders standard markdown text and bold text", () => {
    const { container } = render(<Markdown content="**Bold text** and regular" />);
    expect(container.querySelector("strong")?.textContent).toBe("Bold text");
  });

  it("sanitizes hostile script tags to prevent XSS attacks", () => {
    const malicious = `Hello <script>alert("XSS")</script><img src="x" onerror="alert(1)" /> world`;
    const { container } = render(<Markdown content={malicious} />);

    // Ensure no <script> element exists in the DOM
    expect(container.querySelector("script")).toBeNull();
    // Ensure onerror attribute was stripped
    const img = container.querySelector("img");
    if (img) {
      expect(img.getAttribute("onerror")).toBeNull();
    }
  });

  it("renders fenced code blocks with language tag and copy button", () => {
    const code = "```typescript\nconst a: number = 42;\n```";
    const { container } = render(<Markdown content={code} />);

    expect(container.querySelector("pre")).not.toBeNull();
    expect(container.textContent).toContain("const a: number = 42;");
    expect(container.textContent).toContain("typescript");
    expect(container.textContent).toContain("Copy");
  });

  it("renders interactive citation badges and reveals source card on hover", async () => {
    const sources = [
      {
        title: "Neon Serverless Postgres",
        url: "https://neon.tech",
        snippet: "Neon is a serverless open-source alternative to AWS Aurora Postgres.",
      },
    ];

    const { container, findByRole } = render(
      <Markdown content="Neon is serverless [1] according to docs." sources={sources} />
    );

    const badge = container.querySelector("a[aria-label^='Source 1:']");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("1");
    expect(badge?.getAttribute("href")).toBe("https://neon.tech");

    // Hover reveals the floating source card popover
    const badgeWrapper = badge?.parentElement;
    if (badgeWrapper) {
      const { fireEvent } = await import("@testing-library/react");
      fireEvent.mouseEnter(badgeWrapper);
      const tooltip = await findByRole("tooltip");
      expect(tooltip).toBeDefined();
      expect(tooltip.textContent).toContain("Neon Serverless Postgres");
      expect(tooltip.textContent).toContain("neon.tech");
      expect(tooltip.textContent).toContain("alternative to AWS Aurora");
    }
  });
});
