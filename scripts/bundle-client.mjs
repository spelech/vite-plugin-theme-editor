import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const clientEntry = path.join(rootDir, 'src/client/index.ts');
const targetFile = path.join(rootDir, 'src/client/bundle-inline.ts');

const result = esbuild.buildSync({
  entryPoints: [clientEntry],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: false,
  write: false,
});

const code = result.outputFiles[0].text;

const content = `// Auto-generated inline client script - do not edit directly
export const CLIENT_SCRIPT_INLINE = ${JSON.stringify(code)};
`;

fs.writeFileSync(targetFile, content, 'utf-8');
console.log(`✓ Bundled client script into ${path.relative(rootDir, targetFile)} (${(code.length / 1024).toFixed(2)} KB)`);
