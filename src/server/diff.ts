import * as Diff from 'diff';
import type { DiffResult } from '../types';

export function generateDiff(filePath: string, original: string, modified: string): DiffResult {
  const patch = Diff.createPatch(filePath, original, modified, 'disk', 'staged');
  const changes = Diff.diffLines(original, modified);
  const changesCount = changes.filter(c => c.added || c.removed).length;

  return {
    filePath,
    original,
    modified,
    unifiedDiff: patch,
    changesCount
  };
}
