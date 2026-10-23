# @intel-enterprise-rag-ui/tailwind-theme

This package provides a custom Tailwind CSS theme for the Intel® AI for Enterprise RAG UI, including a custom color palette, dark/light mode and design tokens (`@theme`), and base styles for font, scrollbar and focus, all in `theme.css`.

## Table of Contents

- [Usage](#usage)
- [License](#license)

## Usage

You can use this package in apps or other packages within the workspace.

Add the package as a dependency in `package.json`:

```json
{
  "dependencies": {
    "@intel-enterprise-rag-ui/tailwind-theme": "workspace:*"
  }
}
```

> [!NOTE] No build step is required for this package. It only contains `theme.css` (Tailwind CSS v4 — `@import "tailwindcss"`, `@theme` tokens, dark variant and base styles), consumed directly.

Add `@tailwindcss/vite` to the consumer's `vite.config.ts` (`plugins: [tailwindcss(), ...]`), then import the theme into the main stylesheet:

```css
@import "@intel-enterprise-rag-ui/tailwind-theme/theme.css";
```

Component stylesheets that use `@apply` or theme tokens must reference it (emits no CSS):

```css
@reference "@intel-enterprise-rag-ui/tailwind-theme/theme.css";
```

> [!IMPORTANT]
> Tailwind theme styles should always be imported first to correctly apply it to the application.

## License

See [`LICENSE`](../../../../LICENSE) for license information.
