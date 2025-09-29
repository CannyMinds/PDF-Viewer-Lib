import { PdfiumEngineRunner, DEFAULT_PDFIUM_WASM_URL } from '@embedpdf/engines';
 
async function init() {
  const response = await fetch(DEFAULT_PDFIUM_WASM_URL);
  const wasmBinary = await response.arrayBuffer();
  const runner = new PdfiumEngineRunner(wasmBinary);
  runner.prepare();
}
 
init();