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

