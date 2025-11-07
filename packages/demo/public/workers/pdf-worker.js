// lib/workers/pdf-worker.ts
import { PdfiumEngineRunner } from "@embedpdf/engines";
async function initWorker() {
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
    runner.listen();
  } catch (error) {
    console.error("Worker initialization failed:", error);
    self.postMessage({ type: "error", error: error.message });
  }
}
initWorker();
//# sourceMappingURL=pdf-worker.js.map