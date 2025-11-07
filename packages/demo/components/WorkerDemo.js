// components/WorkerDemo.js
import { useEffect, useState } from "react";
import { createPDFWorkerWithLocalWasm } from "@cannyminds/pdf-viewer";

export default function WorkerDemo() {
  const [result, setResult] = useState("Initializing...");
  const [workerInstance, setWorkerInstance] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Create worker from our lib
        const pdfWorker = createPDFWorkerWithLocalWasm(
          "/workers/pdf-worker.js",
        );
        console.log("[Demo]: ", pdfWorker);
        setWorkerInstance(pdfWorker);

        // Initialize the engine
        const result = await pdfWorker.initialize();
        console.log("result", result);

        // Try to open a document (optional - will fail if demo.pdf doesn't exist)
      } catch (error) {
        console.error("Failed to initialize PDF worker:", error);
        setResult(`Error: ${error.message}`);
      }
    };

    init();

    return () => {
      if (workerInstance) {
        workerInstance.destroy();
      }
    };
  }, []);

  return (
    <div>
      <h1>Web Worker Demo - Local WASM</h1>
      <p>Status: {result}</p>
      <p>This demo uses locally bundled WASM and loads a PDF document.</p>
    </div>
  );
}
