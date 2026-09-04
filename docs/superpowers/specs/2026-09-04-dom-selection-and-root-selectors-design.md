# Design Specification: DOM Selection, Variable Binding, Element Highlighting, and Multi-Root Selector Support

## 1. Overview

This specification enhances `vite-plugin-theme-editor` with:
1. **DOM Element Picker & Variable Binder**: An interactive in-browser picker allowing developers to click any DOM element, inspect its active styling properties, and either bind a property to an existing theme token or extract the value into a new `--*` CSS variable.
2. **Affected Element Highlighting**: Real-time visual outlining and element counting for all DOM elements using or sharing a given CSS variable when hovering/focusing on its editor control.
3. **Multi-Root Selector Support (`rootSelectors`)**: Automatic discovery and categorization of CSS variable declarations across any selector (e.g. `:root`, `html[data-theme="dark"]`, `.theme-dark`, `:host`, etc.), exposing `rootSelectors` in the scan response and ensuring live updates apply to the proper scope.
4. **Unified Staging & AST Disk Sync**: Staging both variable value modifications and newly created variable bindings with interactive line-by-line diff review before saving via PostCSS.

---

## 2. Architecture & Data Model Changes

### 2.1 Types ([`src/types.ts`](file:///containers/dev/vite-plugin-theme-editor/src/types.ts))

```typescript
export type VariableType = 'color' | 'dimension' | 'font' | 'raw';

export interface ThemeVariable {
  name: string;
  value: string;
  inferredType: VariableType;
  selector: string; // e.g. ':root', '[data-theme="dark"]', '.theme-dark'
  unit?: string;
  rawBefore?: string;
  line?: number;
}

export interface FileThemeMap {
  filePath: string;
  relativePath: string;
  rootSelectors: string[]; // List of unique selectors defining variables in this file
  variables: ThemeVariable[];
}

export interface NewVariablePayload {
  selector: string;
  name: string;
  value: string;
}

export interface SavePayload {
  filePath: string;
  updates: Record<string, string>; // varName -> newValue
  newVariables?: NewVariablePayload[];
}

export interface DiffResult {
  filePath: string;
  original: string;
  modified: string;
  unifiedDiff: string;
  changesCount: number;
}
```

---

## 3. Server Components

### 3.1 Scanner ([`src/server/scanner.ts`](file:///containers/dev/vite-plugin-theme-editor/src/server/scanner.ts))

- Walk all CSS rules using PostCSS.
- For each rule that contains `--*` property declarations:
  - Record the rule's `selector` (trimmed).
  - Extract each variable with its name, value, inferred type, line number, and selector.
  - Collect unique selectors into `rootSelectors` per file.

### 3.2 AST Rewriter ([`src/server/rewriter.ts`](file:///containers/dev/vite-plugin-theme-editor/src/server/rewriter.ts))

- **Value Updates**: Walk rules matching the target `selector` (or any rule defining the variable) and update declaration values.
- **New Variable Inserter**: If `newVariables` are provided:
  - Locate the rule matching `newVar.selector` in the file's AST.
  - If the rule exists, append the new `Declaration` (`--name: value;`) with consistent indentation.
  - If the rule does not exist, create the rule node (e.g. `:root { --name: value; }`) and append it to the root AST.
- **AST Preservation**: Preserve comments, line breaks, indentation, and formatting using PostCSS AST manipulation.

### 3.3 Middleware ([`src/server/middleware.ts`](file:///containers/dev/vite-plugin-theme-editor/src/server/middleware.ts))

- Expose `/scan`, `/diff`, and `/save` endpoints.
- `/diff` and `/save` accept updated `SavePayload` including `newVariables`.

---

## 4. Client Components

### 4.1 DOM Element Highlighter & Inspector ([`src/client/inspector.ts`](file:///containers/dev/vite-plugin-theme-editor/src/client/inspector.ts))

1. **Highlight Overlay**:
   - Creates lightweight, pointer-events-none highlight overlays (blue outline with semi-transparent fill and tag/class label).
   - `highlightElements(elements: Element[], label?: string)`: Sets bounding rect positions, dimensions, and label.
   - `clearHighlights()`: Clears all current highlights.
   - `findAffectedElements(varName: string)`: Scans DOM elements whose computed styles or matched CSS rules reference `varName`, returning matching nodes.

2. **Element Picker Tool**:
   - Toggleable inspector mode (`Pick Element` button with crosshair icon).
   - On mousemove: draws hover highlight over candidate DOM element under cursor (ignoring theme editor overlay elements).
   - On click: locks selection, extracts computed styles for key categories (Colors: `color`, `backgroundColor`, `borderColor`; Dimensions: `width`, `height`, `padding`, `margin`, `borderRadius`, `gap`; Typography: `fontFamily`, `fontSize`), and populates the **Inspector Drawer View**.

3. **Binding & Token Extraction**:
   - For any inspected property:
     - **Bind**: Select from existing variables in the active stylesheet with matching type.
     - **Extract**: Input name for new variable (e.g. `--card-radius`), preview value, and stage creation under selected root selector (defaulting to `:root` or active selector).

### 4.2 Overlay & Controls ([`src/client/overlay.ts`](file:///containers/dev/vite-plugin-theme-editor/src/client/overlay.ts))

1. **Selector Tabs / Filter**:
   - Filter variables by selector (`:root`, `[data-theme="dark"]`, etc.) in addition to variable type (`All`, `Colors`, `Dims`, `Fonts`, `Raw`).
2. **Live Preview Mechanism**:
   - For `:root` / `html` / `body` variables: `document.documentElement.style.setProperty(name, value)`.
   - For scoped selectors (e.g. `[data-theme="dark"]`): Injects/updates a dynamic `<style id="__theme_editor_overrides">` block targeting the selector rules directly so live changes take effect across all selector types.
3. **Hover-to-Highlight**:
   - Hovering over any variable row or slider in the list triggers `highlightAffectedElements(varName)`.
   - Displays affected count badge (e.g. `3 matches`) in the variable card header.

### 4.3 Styles & Encapsulation ([`src/client/styles.ts`](file:///containers/dev/vite-plugin-theme-editor/src/client/styles.ts))

- Add styling for the DOM Inspector panel, highlight rects, selector dropdowns, badge counts, and token extraction inputs within the encapsulated Shadow DOM.

---

## 5. Testing & Verification

1. **Unit Tests**:
   - `tests/scanner.test.ts`: Verify multi-selector scanning, `rootSelectors` collection, and variable metadata.
   - `tests/rewriter.test.ts`: Test updating variables within specific selectors and inserting new variable declarations into existing/new rule blocks while preserving comments and whitespace.
   - `tests/middleware.test.ts`: Verify `/scan`, `/diff`, and `/save` with `rootSelectors` and `newVariables`.
2. **Client Tests**:
   - `tests/client.test.ts`: Test DOM selection, computed property extraction, selector overrides style injection, and element highlight query functions.
