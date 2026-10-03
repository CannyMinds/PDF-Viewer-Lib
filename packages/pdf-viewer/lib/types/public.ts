// Public types of <PDFViewer>. Kept source-compatible with the 2.x releases.
import type { CSSProperties, ReactElement } from "react";
import type { ScrollStrategy, Rotation } from "../compat";
type ZoomMode = (typeof import("../compat").ZoomMode)[keyof typeof import("../compat").ZoomMode];
import type { LockMode } from "../lock-types";

/**
 * Annotation as exposed by the ref API. Loosely typed on purpose: EmbedPDF 3
 * has its own annotation model, and the viewer maps it to the shape consumers
 * of the 2.x API already read (id, type, pageIndex, rect, flags, custom, ...).
 */
export type PdfAnnotationObject = Record<string, any>;

/** A form field as listed by ref.forms.getFormFields(). */
export interface FormFieldInfo {
  name: string;
  type: string;
  value: string;
  [key: string]: any;
}

/** Search hit state as returned by ref.search.getSearchState(). */
export interface SearchResult { pageIndex: number; [key: string]: any }
export interface SearchAllPagesResult { results: SearchResult[]; total: number; [key: string]: any }
export interface SearchState { [key: string]: any }

export type FormFieldToolType = "text" | "checkbox" | "radio" | "dropdown" | "listbox";

export interface PDFFormState {
  /** True once the document is known to contain at least one form field. */
  hasFormFields: boolean;
  fieldCount: number;
  /** True when any field value differs from the loaded (or last saved) values. */
  isDirty: boolean;
}

export type FormFieldKind = "text" | "checkbox" | "radio" | "dropdown" | "listbox" | "other";

export interface FormFieldOption {
  label: string;
  isSelected: boolean;
}

/** The form field selected in design mode, as reported by onFormFieldSelect. */
export interface FormFieldDetails {
  annotationId: string;
  pageIndex: number;
  kind: FormFieldKind;
  name: string;
  /** Default value (text fields) / current value. */
  value: string;
  /** Text fields: maximum number of characters, if limited. */
  maxLen?: number;
  /** Dropdowns and list boxes. */
  options?: FormFieldOption[];
  readOnly: boolean;
  required: boolean;
  /** Text fields. */
  multiline: boolean;
  /** Text fields: one character per box; needs maxLen. */
  comb: boolean;
  /** List boxes. */
  multiSelect: boolean;
  /** Visible label drawn on the page just before the field ('' = none). */
  label: string;
}

/** Field properties that can be changed with ref.forms.updateField(). */
export interface FormFieldChanges {
  value?: string;
  /** 0 / null removes the limit (and comb). */
  maxLen?: number | null;
  options?: FormFieldOption[];
  readOnly?: boolean;
  required?: boolean;
  multiline?: boolean;
  comb?: boolean;
  multiSelect?: boolean;
  /** Visible label text; '' removes the label. */
  label?: string;
}

export type RenameFormFieldResult =
  | { outcome: "renamed" | "no-op" }
  /** Another field already has this name; shareField() can merge them. */
  | { outcome: "conflict"; fieldName: string; targetAnnotationId: string };


export type AnnotationSelectionMenu = (props: {
  annotation: any;
  selected: boolean;
  rect: any;
  menuWrapperProps: {
    style?: CSSProperties;
    [key: string]: any;
  };
}) => ReactElement;

/**
 * Permission configuration for controlling PDF features.
 * Allows overriding document permissions for annotations, printing, etc.
 */
export interface PermissionConfig {
  /**
   * When true (default): use PDF's permissions as the base, then apply overrides.
   * When false: treat document as having all permissions allowed, then apply overrides.
   */
  enforceDocumentPermissions?: boolean;

  /**
   * Explicit per-flag overrides.
   * - true = force allow (even if PDF denies)
   * - false = force deny (even if PDF allows)
   * - undefined = use base permissions
   */
  overrides?: {
    /** Allow/deny printing */
    print?: boolean;
    /** Allow/deny modifying document contents */
    modifyContents?: boolean;
    /** Allow/deny copying/extracting text */
    copyContents?: boolean;
    /** Allow/deny modifying annotations (create/update/delete) */
    modifyAnnotations?: boolean;
    /** Allow/deny filling forms */
    fillForms?: boolean;
    /** Allow/deny extraction for accessibility */
    extractForAccessibility?: boolean;
    /** Allow/deny assembling document (insert, rotate, delete pages) */
    assembleDocument?: boolean;
    /** Allow/deny high quality print */
    printHighQuality?: boolean;
  };
}

export interface PDFViewerProps {
  pdfBuffer: Uint8Array | null;
  password?: string;
  enableAnnotations?: boolean;
  userDetails?: {
    name?: string;
    email?: string;
    id?: string;
  };
  className?: string;
  style?: CSSProperties;
  /**
   * Callback when a password is required to open the document.
   * @param fileName - The name of the file being opened
   * @param isRetry - True if this is a retry after an incorrect password was entered
   */
  onPasswordRequest?: (fileName?: string, isRetry?: boolean) => Promise<string | null>;
  /**
   * Callback when the document loads with page count information.
   * @param info - Object containing totalPages and other document info
   */
  onDocumentLoad?: (info: { totalPages: number; currentPage: number }) => void;
  annotationSelectionMenu?: AnnotationSelectionMenu;
  /**
   * Permission configuration for controlling PDF features.
   * Use to override document restrictions for testing or specific use cases.
   */
  permissions?: PermissionConfig;
  /**
   * Whether to hide the default internal loading UI.
   * Useful when using a custom external loading indicator.
   */
  hideInternalLoading?: boolean;
  twoPageMode?: boolean | undefined;
  scrollStrategy?: ScrollStrategy | undefined;
  onPageChange?: ((page: number) => void) | undefined;
  /**
   * Form edit mode: when true the user can type into the PDF's fillable form
   * fields (AcroForm), and the fields are highlighted. When false (view mode)
   * fields are shown with their current values but can't be changed — hosts
   * typically bind this to an "Edit" button.
   * @default false
   */
  enableFormFilling?: boolean;
  /**
   * Called once form fields are detected after load, and whenever a field
   * value changes. Use `isDirty` to drive a "Save" action and
   * `ref.forms.getFilledPdf()` to get the bytes to save.
   */
  onFormStateChange?: (state: PDFFormState) => void;
  /**
   * Form design mode: fields are shown as boxes that can be moved and
   * resized, and `ref.forms.activateFieldTool()` places new fields with a
   * click on the page. Fields can't be filled in while designing — turn this
   * off (and `enableFormFilling` on) to type into them.
   * @default false
   */
  enableFormDesign?: boolean;
  /**
   * Called with the form field selected in design mode (or null when the
   * selection is cleared) and again whenever its properties change — use it
   * to show a field properties panel driven by ref.forms.updateField().
   */
  onFormFieldSelect?: (field: FormFieldDetails | null) => void;
}

export interface PDFViewerRef {
  zoom: {
    zoomIn: () => void;
    zoomOut: () => void;
    setZoom: (level: number) => void;
    resetZoom: () => void;
    getZoom: () => number | ZoomMode;
    fitToWidth: () => void;
    fitToPage: () => void;
  };
  navigation: {
    goToPage: (page: number) => void;
    getCurrentPage: () => number;
    getTotalPages: () => number;
    nextPage: () => void;
    previousPage: () => void;
    goToFirstPage: () => void;
    goToLastPage: () => void;
    setScrollStrategy: (strategy: ScrollStrategy) => void;
    getLayout: () => any;
    setTwoPageMode: (enabled: boolean) => void;
    getTwoPageMode: () => boolean;
    onPageChange: (listener: (event: any) => void) => () => void;
  };
  selection: {
    clearSelection: () => void;
    getSelectedText: () => Promise<string>;
    copy: () => void;
  };
  search: {
    searchText: (keyword: string) => Promise<SearchAllPagesResult | null>;
    nextResult: () => number;
    previousResult: () => number;
    goToResult: (index: number) => number;
    stopSearch: () => void;
    startSearch: () => void;
    getSearchState: () => SearchState | null;
    setShowAllResults: (show: boolean) => void;
  };
  document: {
    isReady: () => boolean;
    isLoading: () => boolean;
    hasPassword: () => boolean;
    getDocumentInfo: () => {
      currentPage: number;
      totalPages: number;
      zoomLevel: number | ZoomMode;
      hasActiveSearch: boolean;
    };
  };
  scroll: {
    scrollToPage: (options: { pageNumber: number; pageCoordinates?: { x: number; y: number }; center?: boolean }) => void;
  };
  rotate: {
    rotateForward: () => void;
    rotateBackward: () => void;
    setRotation: (rotation: Rotation) => void;
    getRotation: () => Rotation;
  };
  /**
   * Annotation namespace — v2.14.1 surface.
   *
   * Tool activation (highlighter / stamp / signature) and CRUD methods come from
   * @embedpdf/plugin-annotation. The lock predicates below let consumers ask the
   * engine whether an annotation is interactive / structurally locked / content
   * locked, instead of re-deriving from the flag array.
   *
   * Consumers express per-user permission by stamping `flags` at import time:
   *   ['readOnly']                 → fully non-interactive (no select/edit/delete)
   *   ['locked', 'lockedContents'] → selectable + deletable, but immovable + content frozen
   *   ['hidden'] | ['noView']      → not rendered at all
   *
   * Document-level: `setLocked({ type: LockModeType.All })` blocks creation of
   * new annotations entirely, including via keyboard shortcuts.
   */
  annotation: {
    activateHighlighter: () => void;
    deactivateHighlighter: () => void;
    isHighlighterActive: () => boolean;
    activateStamp: (imageDataUrl?: string) => void;
    deactivateStamp: () => void;
    isStampActive: () => boolean;
    activateSignature: () => void;
    deactivateSignature: () => void;
    isSignatureActive: () => boolean;
    activateTool: (toolId: string) => void;
    deactivateTool: () => void;
    getActiveTool: () => any | null;
    addStampAnnotation: (imageDataUrl: string, pageIndex: number, x: number, y: number, width: number, height: number, userInfo?: { author?: string; customData?: any }) => boolean;
    addSignatureAnnotation: (signatureDataUrl: string, pageIndex: number, x: number, y: number, width: number, height: number) => boolean;
    deleteSelectedAnnotation: () => boolean;
    /** Deletes a specific annotation by id, regardless of current selection —
     * unlike deleteSelectedAnnotation, works uniformly across every
     * annotation type (stamp, highlight, ink/signature, note) without
     * relying on selection/interactivity state. */
    deleteAnnotationById: (pageIndex: number, annotationId: string) => boolean;
    /** Deletes multiple annotations in one commit — deleteAnnotationById calls
     * commit() per item, and since commit() is async and lock-guarded
     * underneath, back-to-back calls can find the lock already held by an
     * earlier in-flight commit and silently no-op instead of actually
     * waiting, dropping later deletes. This stages every deletion first and
     * commits exactly once. */
    deleteAnnotationsById: (items: Array<{ pageIndex: number; annotationId: string }>) => Promise<boolean>;
    getSelectedAnnotation: () => PdfAnnotationObject | null;
    getSelectedAnnotationDetails: () => any;
    getAllAnnotations: () => PdfAnnotationObject[];
    getAllAnnotationsWithMetadata: () => PdfAnnotationObject[];
    exportAnnotationsAsJSON: () => string;
    onAnnotationEvent: (callback: (event: any) => void) => (() => void) | null;
    updateAnnotation: (pageIndex: number, annotationId: string, updates: Record<string, any>) => boolean;
    selectAnnotation: (pageIndex: number, annotationId: string | null) => boolean;
    importAnnotations: (annotations: Array<{ pageIndex: number; annotation: Record<string, any> }>) => Promise<{ success: number; failed: number }>;
    onStateChange: (callback: (state: any) => void) => (() => void) | null;
    enableClickToPlace: (callback: (clickData: { pageIndex: number; x: number; y: number; pageWidth?: number; pageHeight?: number }) => void) => void;
    placeStampAtPosition: (imageDataUrl: string, pageIndex: number, x: number, y: number) => void;

    // v2.14.1 lock predicates — engine-enforced
    /** False if `noView | hidden | readOnly` flags or category-locked. */
    isAnnotationInteractive: (annotation: PdfAnnotationObject) => boolean;
    /** True if non-interactive OR has `locked` flag (move/resize/rotate frozen). */
    isAnnotationStructurallyLocked: (annotation: PdfAnnotationObject) => boolean;
    /** True if non-interactive OR has `lockedContents` flag (e.g. FreeText text frozen). */
    isAnnotationContentLocked: (annotation: PdfAnnotationObject) => boolean;

    // v2.14.1 document-level lock mode
    setLocked: (mode: LockMode) => void;
    getLocked: () => LockMode;
  };
  download: {
    downloadWithAnnotations: (filename?: string) => Promise<void>;
    downloadWithoutAnnotations: (filename?: string) => Promise<void>;
  };
  print: {
    printWithAnnotations: () => Promise<void>;
    printWithoutAnnotations: () => Promise<void>;
  };
  /** Fillable form (AcroForm) fields — view, fill and save. */
  forms: {
    getFormState: () => PDFFormState;
    getFormFields: () => FormFieldInfo[];
    /** Current values keyed by field name. */
    getFormValues: () => Record<string, string>;
    /** Sets values by field name. Resolves false if forms are unavailable. */
    setFormValues: (values: Record<string, string>) => Promise<boolean>;
    /**
     * The PDF with its form fields as they are in the viewer — added, moved
     * or removed fields and all filled-in values — but without annotations
     * imported through importAnnotations() or drawn in the viewer. Resolves
     * null when the document isn't loaded.
     */
    getFilledPdf: () => Promise<ArrayBuffer | null>;
    /** Treats the current fields and values as saved, so `isDirty` becomes false. */
    markFormSaved: () => void;
    /** Arms a field tool: the next click on a page places that field.
     * Only works while `enableFormDesign` is on. */
    activateFieldTool: (type: FormFieldToolType) => void;
    deactivateFieldTool: () => void;
    getActiveFieldTool: () => FormFieldToolType | null;
    /** The form field selected in design mode, or null. */
    getSelectedField: () => FormFieldDetails | null;
    /** Changes field properties (value, maxLen, options, flags). */
    updateField: (annotationId: string, changes: FormFieldChanges) => boolean;
    /** Renames the field. On a name clash nothing changes and the result says
     * which field has the name — call shareField() to merge them. */
    renameField: (annotationId: string, name: string) => Promise<RenameFormFieldResult>;
    /** Makes the widget part of the target widget's field (same name, shared value). */
    shareField: (annotationId: string, targetAnnotationId: string) => Promise<boolean>;
    deleteField: (annotationId: string) => boolean;
  };
}

