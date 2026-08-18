import postcss, { Declaration } from 'postcss';
import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import type { ThemeVariable, FileThemeMap, VariableType, ThemeEditorOptions } from '../types';

export function inferVariableType(value: string, name: string = ''): VariableType {
  const trimmed = value.trim().toLowerCase();
  const lowerName = name.toLowerCase();

  // Color matching
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('rgb(') ||
    trimmed.startsWith('rgba(') ||
    trimmed.startsWith('hsl(') ||
    trimmed.startsWith('hsla(') ||
    trimmed.startsWith('oklch(') ||
    lowerName.includes('color') ||
    lowerName.includes('bg') ||
    lowerName.includes('border') ||
    lowerName.includes('text') ||
    lowerName.includes('accent') ||
    lowerName.includes('primary')
  ) {
    if (!trimmed.includes('px') && !trimmed.includes('rem') && !trimmed.includes('calc(')) {
      return 'color';
    }
  }

  // Dimension matching
  if (/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|pt)$/.test(trimmed) || 
      lowerName.includes('radius') || 
      lowerName.includes('spacing') || 
      lowerName.includes('gap') || 
      lowerName.includes('padding') || 
      lowerName.includes('margin') || 
      lowerName.includes('size')) {
    return 'dimension';
  }

  // Font matching
  if (lowerName.includes('font') || trimmed.includes('sans-serif') || trimmed.includes('monospace') || trimmed.includes('serif')) {
    return 'font';
  }

  return 'raw';
}

export function parseCssVariables(cssContent: string): ThemeVariable[] {
  const root = postcss.parse(cssContent);
  const variables: ThemeVariable[] = [];

  root.walkRules((rule) => {
    if (rule.selector.includes(':root') || rule.selector.includes('html') || rule.selector.includes('body')) {
      rule.walkDecls((decl: Declaration) => {
        if (decl.prop.startsWith('--')) {
          variables.push({
            name: decl.prop,
            value: decl.value,
            inferredType: inferVariableType(decl.value, decl.prop),
            line: decl.source?.start?.line,
            rawBefore: decl.raws.before
          });
        }
      });
    }
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
        results.push({
          filePath: file,
          relativePath: path.relative(rootDir, file),
          variables
        });
      }
    } catch {
      // Ignore unparseable files
    }
  }

  return results;
}
