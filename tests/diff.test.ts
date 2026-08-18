import { describe, it, expect } from 'vitest';
import { generateDiff } from '../src/server/diff';

describe('diff', () => {
  it('generates line diffs for modified CSS content', () => {
    const original = ':root {\n  --primary: #3b82f6;\n}\n';
    const modified = ':root {\n  --primary: #2563eb;\n}\n';
    const diff = generateDiff('src/index.css', original, modified);

    expect(diff.changesCount).toBeGreaterThan(0);
    expect(diff.unifiedDiff).toContain('-  --primary: #3b82f6;');
    expect(diff.unifiedDiff).toContain('+  --primary: #2563eb;');
  });
});
