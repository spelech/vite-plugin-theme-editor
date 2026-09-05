# NPM Publishing Preparation and CI Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up and prepare `@spelech/vite-plugin-theme-editor` for npm publishing and establish GitHub Actions CI & OIDC Trusted Publishing workflows.

**Architecture:** Update `package.json`, `.gitignore`, `LICENSE`, and `README.md` for npm standards, and add `.github/workflows/ci.yml` (test matrix on Node 18, 20, 22) and `.github/workflows/publish.yml` (automated OIDC Trusted Publishing with `--provenance`).

**Tech Stack:** Node.js, TypeScript, tsup, Vitest, GitHub Actions, npm.

## Global Constraints

- Package Name: `@spelech/vite-plugin-theme-editor`
- Target Registry: `https://registry.npmjs.org`
- Node requirement: `>=18.0.0`
- Access: `public`
- npm Authentication: OIDC Trusted Publishing (`permissions: id-token: write, contents: read`)

---

### Task 1: Package Metadata, License, and Gitignore Cleanup

**Files:**
- Create: `LICENSE`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Existing project structure and build scripts
- Produces: Validated npm package manifest with scoped name, metadata, and gitignore configuration

- [ ] **Step 1: Create `LICENSE` file**

Create standard MIT License for `spelech`:
```text
MIT License

Copyright (c) 2026 spelech

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Update `package.json`**

Update name to `@spelech/vite-plugin-theme-editor`, add metadata (`repository`, `bugs`, `homepage`, `author`, `publishConfig`, `engines`, `sideEffects`), and scripts (`typecheck`, `prepublishOnly`):
```json
{
  "name": "@spelech/vite-plugin-theme-editor",
  "version": "1.0.0",
  "description": "Live in-browser CSS variable theme editor with AST-preserving disk sync for Vite",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build:client": "node scripts/bundle-client.mjs",
    "build": "node scripts/bundle-client.mjs && tsup",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build && npm test",
    "dev": "tsup --watch",
    "test": "vitest run"
  },
  "keywords": [
    "vite",
    "vite-plugin",
    "theme",
    "css-variables",
    "devtools",
    "theme-editor",
    "design-tokens"
  ],
  "author": "spelech",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/spelech/vite-plugin-theme-editor.git"
  },
  "bugs": {
    "url": "https://github.com/spelech/vite-plugin-theme-editor/issues"
  },
  "homepage": "https://github.com/spelech/vite-plugin-theme-editor#readme",
  "engines": {
    "node": ">=18.0.0"
  },
  "sideEffects": false,
  "peerDependencies": {
    "vite": ">=5.0.0"
  },
  "dependencies": {
    "diff": "^7.0.0",
    "fast-glob": "^3.3.2",
    "postcss": "^8.4.38"
  },
  "devDependencies": {
    "@types/diff": "^7.0.0",
    "@types/node": "^20.11.0",
    "esbuild": "^0.21.5",
    "tsup": "^8.0.2",
    "typescript": "^5.4.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Update `.gitignore` and untrack `dist/` from git cache**

Update `.gitignore`:
```gitignore
node_modules/
dist/
coverage/
*.log
.DS_Store
.turbo/
*.tsbuildinfo
```

Untrack `dist/` from git index cache:
```bash
git rm -r --cached dist
```

- [ ] **Step 4: Verify package validation & build**

Run:
```bash
npm run typecheck && npm run build && npm pack --dry-run
```
Expected: Tarball dry run includes `dist/`, `package.json`, `README.md`, `LICENSE` with name `@spelech/vite-plugin-theme-editor`.

- [ ] **Step 5: Commit**

```bash
git add LICENSE package.json .gitignore
git commit -m "chore: configure package metadata, MIT license, and gitignore for npm release"
```

---

### Task 2: Update Documentation & Readme Badges

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Scoped package name `@spelech/vite-plugin-theme-editor`
- Produces: Updated `README.md` with badges, installation snippets, and package details

- [ ] **Step 1: Update `README.md`**

Add status badges (CI status, npm version, license) and update package references:
```markdown
# @spelech/vite-plugin-theme-editor

[![CI](https://github.com/spelech/vite-plugin-theme-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/spelech/vite-plugin-theme-editor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@spelech/vite-plugin-theme-editor.svg)](https://www.npmjs.com/package/@spelech/vite-plugin-theme-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

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
npm install -D @spelech/vite-plugin-theme-editor
```

---

## Usage

Add the plugin to your `vite.config.ts` or `vite.config.js`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { themeEditorPlugin } from '@spelech/vite-plugin-theme-editor';

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

MIT © [spelech](https://github.com/spelech)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update readme with scoped package name and status badges"
```

---

### Task 3: GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Test and build scripts in `package.json`
- Produces: GitHub Actions continuous integration pipeline

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test on Node ${{ matrix.node-version }} (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        node-version: [18.x, 20.x, 22.x]
        os: [ubuntu-latest]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Run unit & integration tests
        run: npm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI workflow with Node 18/20/22 test matrix"
```

---

### Task 4: GitHub Actions npm Publish Workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Consumes: Node 20.x environment, npm registry, OIDC authentication
- Produces: Published package on npm registry with provenance

- [ ] **Step 1: Create `.github/workflows/publish.yml`**

```yaml
name: Publish to npm

on:
  release:
    types: [published]
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    name: Build, Verify and Publish
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Run tests
        run: npm test

      - name: Build package
        run: npm run build

      - name: Publish to npm with provenance
        run: npm publish --provenance --access public
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add GitHub Actions publish workflow with OIDC Trusted Publishing and provenance"
```

---

### Task 5: End-to-End Verification

**Files:**
- Verify: all project files, test suite, build artifacts, git status

- [ ] **Step 1: Run full verification suite locally**

Run:
```bash
npm run typecheck && npm test && npm run build && npm pack --dry-run
```
Expected: All tests pass, types check cleanly, and pack output shows correct scope `@spelech/vite-plugin-theme-editor`.

- [ ] **Step 2: Verify git status is clean**

Run:
```bash
git status
```
Expected: Working tree clean.
