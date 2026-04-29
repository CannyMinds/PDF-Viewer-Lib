import PDFViewer from './PDFViewer';
import { usePDFViewer } from './usePDFViewer';

// Export types
export type { PDFViewerInstance, PDFViewerHookReturn } from './usePDFViewer';
export type { PDFError, PDFErrorType } from './utils/errorTypes';
export type { PDFViewerRef } from './PDFViewer';

// Re-export enums from PDFViewer
export { ZoomMode, Rotation } from './PDFViewer';

// v2.14.1 — annotation lock primitives.
// Currently sourced from a local shim because the local source is on the v1.3.x
// plugin baseline. Once the plugin-migration TODO in PDFViewer.tsx is done and
// @embedpdf/plugin-annotation@2.14.1 is registered, replace these with:
//   export { LockModeType } from '@embedpdf/plugin-annotation';
//   export type { LockMode } from '@embedpdf/plugin-annotation';
//   export { PdfAnnotationFlags, flagsToNames, namesToFlags } from '@embedpdf/models';
//   export type { PdfAnnotationFlagName } from '@embedpdf/models';
export { LockModeType } from './lock-types';
export type { LockMode, PdfAnnotationFlagName } from './lock-types';

export { PDFViewer, usePDFViewer };
