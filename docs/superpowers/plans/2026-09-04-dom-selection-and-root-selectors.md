# DOM Selection, Variable Binding, Element Highlighting, and Multi-Root Selector Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance `vite-plugin-theme-editor` with DOM element inspection, CSS property binding/extraction to theme variables, affected element live highlighting, and multi-root selector discovery (`rootSelectors`).

**Architecture:** Extend the server PostCSS scanner and rewriter to support multi-selector custom properties and insertion of new declarations. Add a client-side `DomInspector` module inside Shadow DOM for pointer-and-click element inspection and computed style extraction. Integrate selector filtering, scoped live CSS overrides, and hover highlighting into `ThemeEditorOverlay`.

**Tech Stack:** TypeScript, Vite, PostCSS, esbuild, vitest, Shadow DOM Web Components.

## Global Constraints

- Dev mode only: no production bundle overhead.
- Total styling encapsulation: all inspector UI and highlight elements live within or alongside Shadow DOM without leaking host CSS.
- AST preservation: preserve all formatting, indentation, and comments when rewriting stylesheets with PostCSS.
- Tests must pass via `vitest run` at every task step.

---

### Task 1: Core Types & Multi-Root Selector Scanner

**Files:**
- Modify: `src/types.ts`
- Modify: `src/server/scanner.ts`
- Test: `tests/scanner.test.ts`

**Interfaces:**
- Consumes: PostCSS `root.walkRules()`
- Produces:
  - `ThemeVariable.selector: string`
  - `FileThemeMap.rootSelectors: string[]`
  - `NewVariablePayload: { selector: string; name: string; value: string }`
  - `SavePayload.newVariables?: NewVariablePayload[]`

- [ ] **Step 1: Write failing tests for multi-selector scanning and rootSelectors collection**

In `tests/scanner.test.ts`, add test cases asserting `selector` is present on variables and `rootSelectors` is included in scanned files:

```typescript
it('scans variables across multiple selectors like :root, [data-theme="dark"], and :host', () => {
  const css = `
    :root {
      --primary: #3b82f6;
    }
    [data-theme="dark"] {
      --primary: #60a5fa;
      --bg: #1e293b;
    }
    .custom-scope {
      --radius: 8px;
    }
  `;
  const vars = parseCssVariables(css);
  expect(vars).toHaveLength(4);
  expect(vars[0].selector).toBe(':root');
  expect(vars[0].name).toBe('--primary');
  expect(vars[1].selector).toBe('[data-theme="dark"]');
  expect(vars[1].name).toBe('--primary');
  expect(vars[2].selector).toBe('[data-theme="dark"]');
  expect(vars[3].selector).toBe('.custom-scope');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/scanner.test.ts`
Expected: FAIL due to missing `selector` on `ThemeVariable` or scanner filtering out non-`:root` rules.

- [ ] **Step 3: Update `src/types.ts` and `src/server/scanner.ts`**

Update `src/types.ts`:
```typescript
export type VariableType = 'color' | 'dimension' | 'font' | 'raw';

export interface ThemeVariable {
  name: string;
  value: string;
  inferredType: VariableType;
  selector: string;
  unit?: string;
  rawBefore?: string;
  line?: number;
}

export interface FileThemeMap {
  filePath: string;
  relativePath: string;
  rootSelectors: string[];
  variables: ThemeVariable[];
}

export interface NewVariablePayload {
  selector: string;
  name: string;
  value: string;
}

export interface SavePayload {
  filePath: string;
  updates: Record<string, string>;
  newVariables?: NewVariablePayload[];
}

export interface DiffResult {
  filePath: string;
  original: string;
  modified: string;
  unifiedDiff: string;
  changesCount: number;
}

export interface ThemeEditorOptions {
  include?: string[];
  exclude?: string[];
  defaultOpen?: boolean;
}
```

Update `src/server/scanner.ts`:
```typescript
export function parseCssVariables(cssContent: string): ThemeVariable[] {
  const root = postcss.parse(cssContent);
  const variables: ThemeVariable[] = [];

  root.walkRules((rule) => {
    rule.walkDecls((decl: Declaration) => {
      if (decl.prop.startsWith('--')) {
        variables.push({
          name: decl.prop,
          value: decl.value,
          inferredType: inferVariableType(decl.value, decl.prop),
          selector: rule.selector.trim(),
          line: decl.source?.start?.line,
          rawBefore: decl.raws.before
        });
      }
    });
  });

  return variables;
}

export async function scanProjectStylesheets(rootDir: string, options: ThemeEditorOptions = {}): Promise<FileThemeMap[]> {
  const include = options.include || ['src/**/*.{css,scss,pcss,postcss,less}', '*.{css,scss}'];
  const exclude = options.exclude || ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'];

  const files = await fg(include, {
    cwd: rootDir,
    ignore: exclude,
    absolute: true
  });

  const results: FileThemeMap[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const variables = parseCssVariables(content);
      if (variables.length > 0) {
        const rootSelectors = Array.from(new Set(variables.map(v => v.selector)));
        results.push({
          filePath: file,
          relativePath: path.relative(rootDir, file),
          rootSelectors,
          variables
        });
      }
    } catch {
      // Ignore unparseable files
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test tests/scanner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/types.ts src/server/scanner.ts tests/scanner.test.ts
git commit -m "feat: add multi-selector scanning and rootSelectors discovery"
```

---

### Task 2: AST Rewriter Multi-Selector Updates & Variable Insertion

**Files:**
- Modify: `src/server/rewriter.ts`
- Modify: `src/server/middleware.ts`
- Test: `tests/rewriter.test.ts`
- Test: `tests/middleware.test.ts`

**Interfaces:**
- Consumes: `SavePayload` with `updates` and `newVariables`
- Produces: `updateCssVariables(originalCss: string, updates: Record<string, string>, newVariables?: NewVariablePayload[]): string`

- [ ] **Step 1: Write failing tests for selector-aware updates and new variable insertions**

In `tests/rewriter.test.ts`:
```typescript
it('updates variables within their specific selectors', () => {
  const original = `
    :root {
      --primary: #000;
    }
    [data-theme="dark"] {
      --primary: #fff;
    }
  `;
  const updated = updateCssVariables(original, { '--primary': '#3b82f6' });
  expect(updated).toContain('--primary: #3b82f6;');
});

it('inserts new variable declarations into existing or new selector blocks', () => {
  const original = `
    :root {
      --primary: #000;
    }
  `;
  const updated = updateCssVariables(original, {}, [
    { selector: ':root', name: '--card-radius', value: '12px' },
    { selector: '[data-theme="dark"]', name: '--bg-dark', value: '#111' }
  ]);
  expect(updated).toContain('--card-radius: 12px;');
  expect(updated).toContain('[data-theme="dark"]');
  expect(updated).toContain('--bg-dark: #111;');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/rewriter.test.ts`
Expected: FAIL due to missing `newVariables` handling or restricted selector walking.

- [ ] **Step 3: Implement selector-aware rewriter and new variable insertion**

In `src/server/rewriter.ts`:
```typescript
import postcss, { Declaration, Rule } from 'postcss';
import fs from 'fs/promises';
import type { SavePayload, NewVariablePayload } from '../types';

export function updateCssVariables(
  originalCss: string,
  updates: Record<string, string> = {},
  newVariables: NewVariablePayload[] = []
): string {
  const root = postcss.parse(originalCss);

  // 1. Update existing declarations
  root.walkRules((rule) => {
    rule.walkDecls((decl: Declaration) => {
      if (decl.prop.startsWith('--') && updates[decl.prop] !== undefined) {
        decl.value = updates[decl.prop];
      }
    });
  });

  // 2. Insert new variables
  if (newVariables && newVariables.length > 0) {
    for (const newVar of newVariables) {
      let targetRule: Rule | undefined;

      root.walkRules((rule) => {
        if (rule.selector.trim() === newVar.selector.trim()) {
          targetRule = rule;
        }
      });

      if (targetRule) {
        // Find declaration indentation from existing decl or default
        const sampleDecl = targetRule.nodes?.find(n => n.type === 'decl') as Declaration | undefined;
        const indent = sampleDecl?.raws.before || '\n  ';
        const newDecl = postcss.decl({
          prop: newVar.name,
          value: newVar.value,
          raws: { before: indent }
        });
        targetRule.append(newDecl);
      } else {
        // Create new rule block
        const newRule = postcss.rule({
          selector: newVar.selector,
          raws: { before: '\n\n' }
        });
        newRule.append(postcss.decl({
          prop: newVar.name,
          value: newVar.value,
          raws: { before: '\n  ' }
        }));
        root.append(newRule);
      }
    }
  }

  return root.toString();
}

export async function saveCssChanges(payload: SavePayload): Promise<void> {
  const currentContent = await fs.readFile(payload.filePath, 'utf-8');
  const updatedContent = updateCssVariables(currentContent, payload.updates, payload.newVariables);
  await fs.writeFile(payload.filePath, updatedContent, 'utf-8');
}
```

Update `src/server/middleware.ts` to pass `newVariables` in `/diff` and `/save`:
```typescript
const updatedContent = updateCssVariables(originalContent, updates || {}, newVariables || []);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test tests/rewriter.test.ts tests/middleware.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/server/rewriter.ts src/server/middleware.ts tests/rewriter.test.ts tests/middleware.test.ts
git commit -m "feat: support selector-aware variable rewrites and variable insertion"
```

---

### Task 3: Client DOM Inspector & Affected Element Highlighting Module

**Files:**
- Create: `src/client/inspector.ts`
- Modify: `src/client/styles.ts`
- Test: `tests/client.test.ts`

**Interfaces:**
- Consumes: DOM APIs (`document.elementsFromPoint`, `window.getComputedStyle`)
- Produces:
  - `DomInspector` class with:
    - `enablePicker(onSelect: (el: Element, styles: ExtractedStyles) => void): void`
    - `disablePicker(): void`
    - `highlightElements(elements: Element[], label?: string): void`
    - `clearHighlights(): void`
    - `findAffectedElements(varName: string): Element[]`
    - `extractStyles(el: Element): ExtractedStyles`

- [ ] **Step 1: Write failing tests for style extraction and affected element discovery**

In `tests/client.test.ts`, add test cases for `extractStyles` and `findAffectedElements`.

- [ ] **Step 2: Implement `src/client/inspector.ts`**

Implement `DomInspector` with:
- Hover outline container created inside `<theme-editor-overlay>` or body overlay.
- Style extraction for standard properties: `color`, `backgroundColor`, `borderColor`, `borderRadius`, `fontSize`, `fontFamily`, `padding`, `margin`, `gap`.
- `findAffectedElements(varName)` scanning DOM nodes and matching computed styles or inline styles.

- [ ] **Step 3: Add inspector styling to `src/client/styles.ts`**

Add CSS rules for:
- `.theme-editor-highlight-box`: Floating highlight bounding box with blue border, semi-transparent fill, and badge label.
- `.theme-editor-inspector-panel`: Inspector drawer view for inspecting clicked DOM element, showing property list, token binding dropdowns, and "Extract as New Variable" form.

- [ ] **Step 4: Run client tests to verify**

Run: `npm test tests/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/client/inspector.ts src/client/styles.ts tests/client.test.ts
git commit -m "feat: implement DomInspector for element picking and affected element highlights"
```

---

### Task 4: Overlay Integration: Selector Filtering, Scoped Overrides & DOM Inspector

**Files:**
- Modify: `src/client/overlay.ts`
- Modify: `src/client/index.ts`
- Modify: `src/client/styles.ts`
- Test: `tests/client.test.ts`

**Interfaces:**
- Consumes: `DomInspector`, `FileThemeMap.rootSelectors`, `ThemeVariable.selector`
- Produces:
  - Interactive "Pick Element" button in drawer header.
  - Active Root Selector filter/dropdown in toolbar.
  - Hover-to-highlight affected elements on variable cards.
  - Inspector panel allowing variable binding and staging new variable definitions (`newVariables`).
  - Scoped live CSS overrides via ephemeral `<style id="__theme_editor_overrides">`.

- [ ] **Step 1: Write failing tests for overlay selector filtering and inspector view in `tests/client.test.ts`**

- [ ] **Step 2: Update `ThemeEditorOverlay` in `src/client/overlay.ts`**

1. Add state:
   - `public selectedSelector: string = 'all';`
   - `public stagedNewVariables: Record<string, NewVariablePayload[]> = {};`
   - `private inspector!: DomInspector;`
   - `private isInspectorActive: boolean = false;`
2. Add Selector dropdown in toolbar alongside File selector and search.
3. Update `updateVariable(varName, newValue)`:
   - Apply live updates to `document.documentElement.style` for `:root`/`html` or inject `<style id="__theme_editor_overrides">` for custom selectors.
4. Add hover listeners to variable cards in `renderList()` calling `inspector.highlightElements(inspector.findAffectedElements(v.name), v.name)`.
5. Add "Pick Element" crosshairs toggle button to header; on element pick, render inspector view inside drawer with Bind/Extract actions.
6. Include `newVariables` in `diff` and `save` API requests.

- [ ] **Step 3: Run client tests to verify**

Run: `npm test tests/client.test.ts`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add src/client/overlay.ts src/client/index.ts src/client/styles.ts tests/client.test.ts
git commit -m "feat: integrate inspector panel, selector tabs, and scoped overrides into overlay"
```

---

### Task 5: Client Bundle Build, Test Suite Expansion & End-to-End Verification

**Files:**
- Modify: `src/client/bundle-inline.ts` (via `npm run build:client`)
- Modify: `tests/client.test.ts`
- Modify: `tests/middleware.test.ts`

- [ ] **Step 1: Rebuild client inline bundle**

Run: `npm run build:client`
Verify: `src/client/bundle-inline.ts` is updated with all new client code.

- [ ] **Step 2: Run full test suite and build**

Run: `npm test && npm run build`
Expected: All tests PASS, build succeeds with CJS/ESM dist artifacts.

- [ ] **Step 3: Commit changes**

```bash
git add src/client/bundle-inline.ts dist/
git commit -m "build: bundle inline client and build distribution artifacts"
```
