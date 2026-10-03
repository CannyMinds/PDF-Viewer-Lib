import PDFViewer from './PDFViewer';
import { usePDFViewer } from './usePDFViewer';

// Export types
export type { PDFViewerInstance, PDFViewerHookReturn } from './usePDFViewer';
export type { PDFError, PDFErrorType } from './utils/errorTypes';
export type { PDFViewerRef, PDFViewerProps, PermissionConfig, PDFFormState, FormFieldInfo, FormFieldToolType, FormFieldKind, FormFieldOption, FormFieldDetails, FormFieldChanges, RenameFormFieldResult } from './PDFViewer';
export { isFormFieldLabel, FORM_FIELD_LABEL_MARKER } from './forms/labels';
export { PdfThumbnailSidebar } from './PdfThumbnailSidebar';
export type { PdfThumbnailSidebarProps } from './PdfThumbnailSidebar';

// Re-export enums from PDFViewer
export { ZoomMode, Rotation } from './PDFViewer';
export { ScrollStrategy } from './compat';

// Annotation lock primitives. These are the viewer's own types (the lock mode
// passed to ref.annotation.setLocked), kept as they were in 2.x.
export { LockModeType } from './lock-types';
export type { LockMode, PdfAnnotationFlagName } from './lock-types';

export { PDFViewer, usePDFViewer };
