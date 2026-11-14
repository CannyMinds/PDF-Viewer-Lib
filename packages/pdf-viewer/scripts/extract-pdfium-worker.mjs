// Writes dist/pdfium-worker.js: the PDFium worker script that
// @embedpdf/engines inlines as a string in createPdfiumEngine() and starts
// from a blob: URL. Shipping it as a file lets lib/usePdfiumEngine.ts start
// it from a real URL instead (see that file for why).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const enginePath = fileURLToPath(import.meta.resolve('@embedpdf/engines/pdfium-worker-engine'));
const code = readFileSync(enginePath, 'utf8');

const factoryAt = code.indexOf('function createPdfiumEngine(');
const blobAt = code.indexOf('new Blob([', factoryAt);
if (factoryAt < 0 || blobAt < 0) throw new Error(`PDFium worker source not found in ${enginePath}`);

// Read the string literal passed to new Blob([...]).
const start = blobAt + 'new Blob(['.length;
const quote = code[start];
let end = start + 1;
while (code[end] !== quote) end += code[end] === '\\' ? 2 : 1;
const source = vm.runInNewContext(code.slice(start, end + 1));

for (const marker of ['self.onmessage', '"wasmInit"', 'PdfiumEngineRunner']) {
  if (!source.includes(marker)) throw new Error(`Extracted PDFium worker source lacks ${marker}`);
}

// Minified like the rest of the host app's code. The engine inlines this
// source unminified, with its developer comments, and host apps serve the file
// as a static asset without minifying it (ZAP flagged the comments as
// "Information Disclosure - Suspicious Comments"). License comments are kept.
// esbuild is tsup's own dependency.
const { transformSync } = createRequire(import.meta.resolve('tsup'))('esbuild');
const { code: minified } = transformSync(source, { minify: true });

writeFileSync(new URL('../dist/pdfium-worker.js', import.meta.url), minified);
console.log(
  `pdfium-worker.js: ${(minified.length / 1024).toFixed(0)} KB (${(source.length / 1024).toFixed(0)} KB before minifying) from ${enginePath}`,
);
