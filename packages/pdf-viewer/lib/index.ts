import PDFViewer from './PDFViewer';
import { usePDFViewer } from './usePDFViewer';

// Export types
export type { PDFViewerInstance, PDFViewerHookReturn } from './usePDFViewer';
export type { PDFError, PDFErrorType } from './utils/errorTypes';
export type { PDFViewerRef } from './PDFViewer';

// Re-export enums from PDFViewer
export { ZoomMode, Rotation } from './PDFViewer';

export { PDFViewer, usePDFViewer };