import { useEffect, useRef, useState } from 'react';

type PdfiumEngine = ReturnType<typeof import('@embedpdf/engines/pdfium-worker-engine').createPdfiumEngine>;

// The default @embedpdf/engines/react's usePdfiumEngine uses.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.15.0/dist/pdfium.wasm';

/**
 * Same as @embedpdf/engines/react's usePdfiumEngine, except PDFium runs in a
 * worker loaded from a real URL (dist/pdfium-worker.js, which the host app's
 * bundler emits as a same-origin file) instead of a blob: URL. A blob: worker
 * inherits the page's Content-Security-Policy, so compiling pdfium.wasm in it
 * required 'wasm-unsafe-eval' on every page that shows a PDF. A URL worker
 * runs under its own response's policy, so host apps can drop that keyword.
 */
export function usePdfiumEngine() {
  const [engine, setEngine] = useState<PdfiumEngine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const engineRef = useRef<PdfiumEngine | null>(null);

  useEffect(() => {
    let cancelled = false;
    let worker: Worker | null = null;
    const onWorkerError = (event: ErrorEvent) => {
      if (cancelled) return;
      setError(new Error(event.message || 'Failed to load the PDFium worker'));
      setIsLoading(false);
    };

    (async () => {
      try {
        const { createPdfiumEngine } = await import('@embedpdf/engines/pdfium-worker-engine');
        try {
          // Resolved on its own line on purpose: bundlers treat it as a plain
          // asset URL. Written inline as new Worker(new URL(...)) they compile
          // it as a worker entry, and Turbopack then starts that from a blob:
          // URL, which brings back the page-CSP problem.
          const workerUrl = new URL('./pdfium-worker.js', import.meta.url);
          worker = new Worker(workerUrl.href, { type: 'module' });
        } catch {
          // No import.meta.url (CommonJS build): keep the stock blob: worker.
        }
        // The engine never hears about a worker that fails to load (e.g. a
        // 404), so report it here instead of waiting forever.
        worker?.addEventListener('error', onWorkerError);
        const pdfEngine = worker
          ? withPdfiumWorker(worker, () => createPdfiumEngine(WASM_URL))
          : createPdfiumEngine(WASM_URL);
        engineRef.current = pdfEngine;
        setEngine(pdfEngine);
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      worker?.removeEventListener('error', onWorkerError);
      engineRef.current?.closeAllDocuments?.().wait(() => {
        engineRef.current?.destroy?.();
        engineRef.current = null;
      }, () => {});
    };
  }, []);

  return { engine, isLoading, error };
}

/**
 * createPdfiumEngine() builds its PDFium worker from a blob: URL and has no
 * option to pass one in. It creates that worker first, synchronously, then
 * its image-encoder pool, so for the duration of the call the first
 * `new Worker(...)` returns `worker` and later ones pass through.
 */
function withPdfiumWorker(worker: Worker, create: () => PdfiumEngine): PdfiumEngine {
  const NativeWorker = globalThis.Worker;
  let handedOver = false;
  globalThis.Worker = function (url: string | URL, options?: WorkerOptions) {
    if (handedOver) return new NativeWorker(url, options);
    handedOver = true;
    URL.revokeObjectURL(String(url));
    return worker;
  } as unknown as typeof Worker;
  try {
    return create();
  } finally {
    globalThis.Worker = NativeWorker;
  }
}
