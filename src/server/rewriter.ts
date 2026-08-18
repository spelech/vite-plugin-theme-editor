import postcss, { Declaration } from 'postcss';
import fs from 'fs/promises';
import type { SavePayload } from '../types';

export function updateCssVariables(originalCss: string, updates: Record<string, string>): string {
  const root = postcss.parse(originalCss);

  root.walkRules((rule) => {
    if (rule.selector.includes(':root') || rule.selector.includes('html') || rule.selector.includes('body')) {
      rule.walkDecls((decl: Declaration) => {
        if (decl.prop.startsWith('--') && updates[decl.prop] !== undefined) {
          decl.value = updates[decl.prop];
        }
      });
    }
  });

  return root.toString();
}

export async function saveCssChanges(payload: SavePayload): Promise<void> {
  const currentContent = await fs.readFile(payload.filePath, 'utf-8');
  const updatedContent = updateCssVariables(currentContent, payload.updates);
  await fs.writeFile(payload.filePath, updatedContent, 'utf-8');
}
