import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['lib/index.ts', 'lib/workers/pdf-worker.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom']
})