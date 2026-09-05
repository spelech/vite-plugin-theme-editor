# Specification: NPM Publishing Preparation and CI/CD Setup

**Date**: 2026-09-05  
**Package**: `@spelech/vite-plugin-theme-editor`  
**Target Registry**: npm (`registry.npmjs.org`)  

---

## 1. Objectives

- Prepare the codebase and repository metadata for public npm publishing under the scoped package name `@spelech/vite-plugin-theme-editor`.
- Implement a robust Continuous Integration (CI) pipeline on GitHub Actions to validate builds and run test suites across Node.js versions (18.x, 20.x, 22.x).
- Implement an automated npm Publishing workflow via GitHub Actions utilizing npm OIDC Trusted Publishing (passwordless/tokenless authentication) and cryptographic provenance (`--provenance`).
- Clean up repository git tracking by ignoring built distribution files (`dist/`) and ensuring build scripts generate clean release artifacts.

---

## 2. Detailed Specifications

### 2.1 Package Metadata & Cleanup (`package.json`)

1. **Package Name & Scope**:
   - `"name": "@spelech/vite-plugin-theme-editor"`
   - `"publishConfig": { "access": "public" }`
2. **Metadata Fields**:
   - `"author": "spelech"`
   - `"repository": { "type": "git", "url": "git+https://github.com/spelech/vite-plugin-theme-editor.git" }`
   - `"bugs": { "url": "https://github.com/spelech/vite-plugin-theme-editor/issues" }`
   - `"homepage": "https://github.com/spelech/vite-plugin-theme-editor#readme"`
   - `"engines": { "node": ">=18.0.0" }`
   - `"sideEffects": false`
3. **Scripts**:
   - `"typecheck": "tsc --noEmit"`
   - `"prepublishOnly": "npm run build && npm test"`
   - `"build:client": "node scripts/bundle-client.mjs"`
   - `"build": "node scripts/bundle-client.mjs && tsup"`
   - `"test": "vitest run"`
4. **Files to Include in Tarball**:
   - `"files": ["dist"]`
   - (Note: `README.md` and `LICENSE` are included automatically by npm).

### 2.2 Licensing (`LICENSE`)

- Create `LICENSE` file containing the standard MIT license text attributed to `spelech`.

### 2.3 Git Configuration & Ignored Files (`.gitignore`)

- Add `dist/`, `.turbo/`, and `*.tsbuildinfo` to `.gitignore`.
- Remove tracked `dist/` artifacts from git index cache (`git rm -r --cached dist`) while leaving source scripts and assets intact.

### 2.4 Documentation Updates (`README.md`)

- Update package name references and code installation/usage examples to `@spelech/vite-plugin-theme-editor`.
- Add status badges:
  - GitHub Actions CI badge
  - npm version and downloads badge
  - License badge

### 2.5 GitHub Actions Workflows

#### 2.5.1 CI Workflow (`.github/workflows/ci.yml`)
- **Triggers**:
  - `push` to `main`
  - `pull_request` to `main`
- **Matrix**:
  - `node-version`: `[18.x, 20.x, 22.x]`
  - `os`: `ubuntu-latest`
- **Steps**:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with Node matrix version and `cache: 'npm'`
  3. `npm ci`
  4. `npm run typecheck`
  5. `npm run build`
  6. `npm test`

#### 2.5.2 Publish Workflow (`.github/workflows/publish.yml`)
- **Triggers**:
  - `release`: `types: [published]`
  - `workflow_dispatch` (manual execution)
- **Permissions**:
  - `contents: read`
  - `id-token: write` (required for npm OIDC Trusted Publishing & Provenance)
- **Steps**:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with Node 20.x, `registry-url: 'https://registry.npmjs.org'`, and `cache: 'npm'`
  3. `npm ci`
  4. `npm run typecheck`
  5. `npm test`
  6. `npm run build`
  7. `npm publish --provenance --access public`

---

## 3. npm OIDC Trusted Publishing Setup Instructions

To activate Trusted Publishing on npmjs.com:
1. Log in to [npmjs.com](https://www.npmjs.com/).
2. If publishing scoped for the first time: Ensure your scope `@spelech` exists or publish the first release (or create the package / configure publishing on npm settings).
3. Go to the package settings on npm -> **Publishing Access** -> **Trusted Publishers** -> **GitHub Actions**.
4. Set Repository: `spelech/vite-plugin-theme-editor`, Workflow filename: `publish.yml`, Environment: (empty or as configured).
5. No long-lived secret tokens (`NPM_TOKEN`) needed in GitHub Secrets.

---

## 4. Verification & Testing Criteria

- `npm run typecheck` passes with zero errors.
- `npm test` passes all tests.
- `npm run build` generates `dist/` cleanly.
- `npm pack --dry-run` confirms the package tarball contains only `dist/`, `README.md`, `LICENSE`, and `package.json`.
- GitHub action workflow YAML files are valid and linted.
