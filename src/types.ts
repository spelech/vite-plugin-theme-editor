export type VariableType = 'color' | 'dimension' | 'font' | 'raw';

export interface ThemeVariable {
  name: string;
  value: string;
  inferredType: VariableType;
  unit?: string;
  rawBefore?: string;
  line?: number;
}

export interface FileThemeMap {
  filePath: string;
  relativePath: string;
  variables: ThemeVariable[];
}

export interface ThemeEditorOptions {
  include?: string[];
  exclude?: string[];
  defaultOpen?: boolean;
}

export interface DiffResult {
  filePath: string;
  original: string;
  modified: string;
  unifiedDiff: string;
  changesCount: number;
}

export interface SavePayload {
  filePath: string;
  updates: Record<string, string>;
}
