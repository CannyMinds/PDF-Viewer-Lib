import { PdfiumEngineRunner } from "@embedpdf/engines";

async function initWorker() {
  // Get the worker's location to resolve the WASM path relative to it
  const workerUrl = new URL(self.location.href);
  const wasmUrl = new URL("/workers/pdfium.wasm", workerUrl.origin);
  
  try {
    const response = await fetch(wasmUrl.href);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
    }
    const wasmBinary = await response.arrayBuffer();
    const runner = new PdfiumEngineRunner(wasmBinary);
    await runner.prepare();
    
    // Set up the worker communication layer
    runner.listen();
  } catch (error: any) {
    console.error("Worker initialization failed:", error);
    // Post error back to main thread
    self.postMessage({ type: 'error', error: error.message });
  }
}

initWorker();
