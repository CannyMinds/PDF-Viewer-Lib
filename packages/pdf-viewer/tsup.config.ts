import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['lib/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
  // Ships dist/pdfium-worker.js next to index.js (see lib/usePdfiumEngine.ts).
  onSuccess: 'node scripts/extract-pdfium-worker.mjs',
})