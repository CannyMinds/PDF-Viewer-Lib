// components/WorkerDemo.js
import { useEffect, useState } from "react";
import { WebWorkerEngine } from "@embedpdf/engines/worker";

export default function WorkerDemo() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const init = async () => {
      const worker = new Worker(new URL("./webworker.ts", import.meta.url), {
        type: "module",
      });
      const engine = new WebWorkerEngine(worker);

      // Initialize the engine
      await engine.initialize().toPromise();
    };

    init();

    return () => {
      worker.terminate(); // cleanup
    };
  }, []);

  return (
    <div>
      <h1>Web Worker Demo</h1>
      <p>Result from worker: {result}</p>
    </div>
  );
}
