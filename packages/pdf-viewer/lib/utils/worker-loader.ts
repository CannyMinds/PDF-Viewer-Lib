import { WebWorkerEngine } from "@embedpdf/engines/worker";

export interface WorkerConfig {
  wasmPath?: string;
  workerPath: string;
}

export function createPDFWorker(config: WorkerConfig) {
  console.log("from create pdf worker");
  if (!config.workerPath) {
    throw new Error(
      "workerPath is required. Please provide the path to pdf-worker.js",
    );
  }

  const worker = new Worker(config.workerPath, {
    type: "module",
  });

  const engine = new WebWorkerEngine(worker);

  console.log("engine", engine);

  return {
    engine,
    worker,
    async initialize() {
      console.log("[WorkerLoader]: Starting engine initialization...");
      try {
        // Add timeout to detect hanging
        const initPromise = engine.initialize().toPromise();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Initialization timeout after 10s")), 10000)
        );
        
        const result = await Promise.race([initPromise, timeoutPromise]);
        console.log("[WorkerLoader]: Engine initialized successfully:", result);
        return result;
      } catch (error) {
        console.error("[WorkerLoader]: Engine initialization failed:", error);
        throw error;
      }
    },
    destroy() {
      worker.terminate();
    },
  };
}

export function createPDFWorkerWithLocalWasm(
  workerPath: string,
  wasmPath?: string,
) {
  // This function creates a worker that uses the WASM from @embedpdf/pdfium package
  // No CDN dependency - everything comes from npm packages
  console.log("worker path", workerPath);
  const config: WorkerConfig = { workerPath };
  if (wasmPath) {
    config.wasmPath = wasmPath;
  }
  return createPDFWorker(config);
}
