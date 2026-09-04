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
