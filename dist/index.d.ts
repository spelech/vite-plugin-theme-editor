import { Connect, Plugin } from 'vite';

type VariableType = 'color' | 'dimension' | 'font' | 'raw';
interface ThemeVariable {
    name: string;
    value: string;
    inferredType: VariableType;
    selector: string;
    unit?: string;
    rawBefore?: string;
    line?: number;
}
interface FileThemeMap {
    filePath: string;
    relativePath: string;
    rootSelectors: string[];
    variables: ThemeVariable[];
}
interface NewVariablePayload {
    selector: string;
    name: string;
    value: string;
}
interface SavePayload {
    filePath: string;
    updates: Record<string, string>;
    newVariables?: NewVariablePayload[];
}
interface DiffResult {
    filePath: string;
    original: string;
    modified: string;
    unifiedDiff: string;
    changesCount: number;
}
interface ThemeEditorOptions {
    include?: string[];
    exclude?: string[];
    defaultOpen?: boolean;
}

declare function createThemeEditorMiddleware(rootDir: string, options?: ThemeEditorOptions): Connect.NextHandleFunction;

declare function themeEditorPlugin(options?: ThemeEditorOptions): Plugin;

export { type DiffResult, type FileThemeMap, type NewVariablePayload, type SavePayload, type ThemeEditorOptions, type ThemeVariable, type VariableType, createThemeEditorMiddleware, themeEditorPlugin as default, themeEditorPlugin };
