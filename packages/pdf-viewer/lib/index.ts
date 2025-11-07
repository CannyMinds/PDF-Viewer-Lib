import PDFViewer from "./PDFViewer";
// import download from "./utils/download";

// Export types
export type { PDFViewerInstance, PDFViewerHookReturn } from "./usePDFViewer";
export type { PDFError, PDFErrorType } from "./utils/errorTypes";
export type { WorkerConfig } from "./utils/worker-loader";

// Export worker utilities
export { createPDFWorker, createPDFWorkerWithLocalWasm } from "./utils/worker-loader";

export { PDFViewer };
