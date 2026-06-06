import PDFViewer from './PDFViewer';
import { usePDFViewer } from './usePDFViewer';

// Export types
export type { PDFViewerInstance, PDFViewerHookReturn } from './usePDFViewer';
export type { PDFError, PDFErrorType } from './utils/errorTypes';
export type { PDFViewerRef, PDFViewerProps, PermissionConfig } from './PDFViewer';
export { PdfThumbnailSidebar } from './PdfThumbnailSidebar';
export type { PdfThumbnailSidebarProps } from './PdfThumbnailSidebar';

// Re-export enums from PDFViewer
export { ZoomMode, Rotation } from './PDFViewer';

// v2.14.1 — annotation lock primitives.
// Sourced from a local shim because the runtime is on @embedpdf/plugin-annotation@2.2.0,
// which doesn't yet expose LockMode / isAnnotationInteractive / etc. The ref methods
// proxy to annotationCap with safe fallbacks (interactive=true, locked=false, no-op).
// Once the plugin set is bumped to 2.14.x, replace this shim with:
//   export { LockModeType } from '@embedpdf/plugin-annotation';
//   export type { LockMode } from '@embedpdf/plugin-annotation';
//   export { PdfAnnotationFlags, flagsToNames, namesToFlags } from '@embedpdf/models';
//   export type { PdfAnnotationFlagName } from '@embedpdf/models';
export { LockModeType } from './lock-types';
export type { LockMode, PdfAnnotationFlagName } from './lock-types';

export { PDFViewer, usePDFViewer };
