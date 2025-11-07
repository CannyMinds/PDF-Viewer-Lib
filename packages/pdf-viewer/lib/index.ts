import PDFViewer from './PDFViewer';
import { usePDFViewer } from './usePDFViewer';

// Export types
export type { PDFViewerInstance, PDFViewerHookReturn } from './usePDFViewer';
export type { PDFError, PDFErrorType } from './utils/errorTypes';
export type { PDFViewerRef } from './PDFViewer';

// Re-export annotation types from @embedpdf/models
export type {
  PdfAnnotationObject,
  PdfHighlightAnnoObject,
  PdfInkAnnoObject,
  PdfFreeTextAnnoObject,
  PdfStampAnnoObject,
  PdfAnnotationSubtype,
  Rect,
  Position
} from '@embedpdf/models';

// Re-export enums from PDFViewer
export { ZoomMode, Rotation } from './PDFViewer';

// Re-export annotation hook for advanced usage
export { useAnnotationCapability } from '@embedpdf/plugin-annotation/react';

export { PDFViewer, usePDFViewer };