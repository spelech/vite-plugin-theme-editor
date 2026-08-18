# vite-plugin-theme-editor

> Live in-browser CSS variable (`:root`) theme editor with instant visual feedback and AST-preserving disk sync for Vite projects.

---

## Features

- ⚡ **Zero-Latency Live Preview**: Mutates `document.documentElement.style` instantly for sub-millisecond visual updates as you adjust sliders and color pickers.
- 🎨 **Smart Variable Controls**: Auto-detects CSS variable types:
  - **Colors**: Dual color swatch preview + native color picker + HEX/RGBA text inputs.
  - **Dimensions / Radii / Spacing**: Adaptive range sliders + numeric inputs with CSS unit selectors (`px`, `rem`, `em`, `%`, etc.).
  - **Fonts & Typography**: Font family text inputs with live preview samples.
  - **Raw / Fallback**: Safe text editing for complex CSS functions, shadows, or gradients.
- 🛡️ **Zero Styling Pollution (Shadow DOM)**: The entire editor UI lives inside an encapsulated Web Component (`<theme-editor-overlay>`). No host CSS leaks in, and editor styles never alter your application.
- 📝 **AST-Preserving Disk Sync**: Uses PostCSS to update CSS variables directly in source files on disk while preserving all comments, indentation, formatting, and empty lines.
- 🔍 **Interactive Diff Preview**: Previews syntax-highlighted line-by-line additions and deletions before saving changes to disk.
- 🚀 **Dev Mode Only**: Injected only during `vite dev` (`apply: 'serve'`). **0KB production bundle overhead.**
- ⌨️ **Keyboard Shortcut**: Press `Alt + T` (or `Option + T` on macOS) to quickly toggle the editor drawer.

---

## Installation

```bash
npm install -D vite-plugin-theme-editor
```

---

## Usage

Add the plugin to your `vite.config.ts` or `vite.config.js`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { themeEditorPlugin } from 'vite-plugin-theme-editor';

export default defineConfig({
  plugins: [
    react(),
    themeEditorPlugin()
  ]
});
```

---

## Options

```typescript
interface ThemeEditorOptions {
  /**
   * Glob patterns for stylesheets to scan for CSS custom properties.
   * Default: ['src/**/*.{css,scss,pcss,postcss,less}', '*.{css,scss}']
   */
  include?: string[];

  /**
   * Glob patterns to ignore.
   * Default: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**']
   */
  exclude?: string[];

  /**
   * Open the editor drawer by default on page load.
   * Default: false
   */
  defaultOpen?: boolean;
}
```

---

## License

MIT
