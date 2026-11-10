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
});
