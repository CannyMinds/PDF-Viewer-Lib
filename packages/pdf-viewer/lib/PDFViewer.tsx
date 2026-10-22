import { EmbedPDF, useDocumentState, usePlugin } from "@embedpdf/core/react";
// FilePicker moved to plugin-document-manager in v2.x
import {
  Viewport,
  ViewportPluginPackage,
} from "@embedpdf/plugin-viewport/react";
import {
  Scroller,
  ScrollPluginPackage,
  ScrollStrategy,
  useScrollPlugin,
} from "@embedpdf/plugin-scroll/react";
import {
  RenderLayer,
  RenderPluginPackage,
} from "@embedpdf/plugin-render/react";
import { SelectionLayer, useSelectionCapability, SelectionPluginPackage } from "@embedpdf/plugin-selection/react";
import { SearchLayer } from "@embedpdf/plugin-search/react";
import {
  InteractionManagerPluginPackage,
  PagePointerProvider,
  GlobalPointerProvider,
} from "@embedpdf/plugin-interaction-manager/react";
import { useZoom, ZoomMode, ZoomPluginPackage } from "@embedpdf/plugin-zoom/react";
import { useSearch } from "@embedpdf/plugin-search/react";
import { useScroll } from "@embedpdf/plugin-scroll/react";
import { useRotate, Rotate, RotatePluginPackage } from "@embedpdf/plugin-rotate/react";
import {
  useAnnotationCapability,
  AnnotationLayer,
  AnnotationPluginPackage,
  useRegisterRenderers,
  createRenderer,
} from "@embedpdf/plugin-annotation/react";
import { LockModeType as AnnotationLockModeType } from "@embedpdf/plugin-annotation";
import { usePrintCapability, PrintPluginPackage } from "@embedpdf/plugin-print/react";
// The base (non-React) form package is registered on purpose: the React one
// auto-mounts its own renderer registration, and we register a wrapped copy of
// those renderers instead (see lockableFormRenderers) so fields can be made
// read-only without re-creating the plugin registry.
import { FormPluginPackage } from "@embedpdf/plugin-form";
import type { FormFieldInfo } from "@embedpdf/plugin-form";
import { formRenderers, useFormCapability, useFormPlugin } from "@embedpdf/plugin-form/react";
import { PdfAnnotationSubtype, PdfErrorCode, PDF_FORM_FIELD_FLAG, PDF_FORM_FIELD_TYPE, PdfStandardFont, PdfTextAlignment, PdfVerticalAlignment } from "@embedpdf/models";
import { buildFilledPdf, sameFormValues, taskToPromise } from "./utils/formExport";
import { HistoryPluginPackage } from "@embedpdf/plugin-history";
import { Rotation } from "@embedpdf/models";

// v2.14.1 — annotation plugin (gated; needs full plugin migration from 1.3.x)
// TODO(plugin-migration): wire AnnotationPluginPackage in createPluginRegistration list,
// and replace the `annotationCap as any` casts below with `useAnnotationCapability().provides`.
// See packages/plugin-annotation/src/lib/types.ts (AnnotationCapability) in embed-pdf-viewer-main.
// import {
//   useAnnotationCapability,
//   AnnotationPluginPackage,
// } from "@embedpdf/plugin-annotation/react";
import type { LockMode } from "./lock-types";
import type { PdfAnnotationObject } from "@embedpdf/models";

// Re-export for consuming apps
export { ZoomMode, Rotation, usePrintCapability };
export type { SearchState } from "@embedpdf/plugin-search";
export type { SearchResult, SearchAllPagesResult, MatchFlag } from "@embedpdf/models";
export type { FormFieldInfo } from "@embedpdf/plugin-form";

// Import types for internal use
import type { SearchAllPagesResult } from "@embedpdf/models";
import type { SearchState } from "@embedpdf/plugin-search";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
  type ReactElement,
  type ReactNode,
  useState,
  useRef,
  type CSSProperties,
} from "react";


import { usePdfiumEngine } from "@embedpdf/engines/react";
import { createPluginRegistration, BasePlugin } from "@embedpdf/core";
import { AnnotationFloatingToolbar } from "./components/AnnotationFloatingToolbar";
import { DocumentManagerPluginPackage, DocumentContent, useDocumentManagerCapability } from "@embedpdf/plugin-document-manager/react";
// SelectionPluginPackage now imported from react subpath (includes CopyToClipboard utility)
import { SearchPluginPackage } from "@embedpdf/plugin-search";

// ---------------------------------------------------------------------------
// Patch @embedpdf/plugin-scroll package's HorizontalScrollStrategy prototype to fix layout & navigation bugs in horizontal scrolling mode.
// ---------------------------------------------------------------------------
if (ScrollPluginPackage && typeof ScrollPluginPackage.create === 'function') {
  const originalScrollPluginCreate = ScrollPluginPackage.create;
  ScrollPluginPackage.create = function(registry: any, config: any) {
    const pluginInstance = originalScrollPluginCreate.call(this, registry, config);
    
    if (pluginInstance && typeof (pluginInstance as any).createStrategy === 'function') {
      const originalCreateStrategy = (pluginInstance as any).createStrategy;
      (pluginInstance as any).createStrategy = function(strategyType: any) {
        const strategy = originalCreateStrategy.call(this, strategyType);
        if (strategy) {
          const proto = Object.getPrototypeOf(strategy);
          if (proto && !proto.__isPatched) {
            proto.__isPatched = true;
            
            // 1. Patch getRectLocationForPage: Fix horizontal centering offset bug
            const originalGetRectLocation = proto.getRectLocationForPage;
            proto.getRectLocationForPage = function(pageNumber: number, virtualItems: any[], totalContentSize: any) {
              const isHorizontal = this.constructor.name === 'HorizontalScrollStrategy';
              if (isHorizontal) {
                const item = virtualItems.find((item2) => item2.pageNumbers.includes(pageNumber));
                if (!item) return null;
                const pageLayout = item.pageLayouts.find((layout: any) => layout.pageNumber === pageNumber);
                if (!pageLayout) return null;
                
                let centeringOffsetY = 0;
                if (totalContentSize) {
                  const maxHeight = totalContentSize.height;
                  if (item.height < maxHeight) {
                    centeringOffsetY = (maxHeight - item.height) / 2;
                  }
                }
                return {
                  origin: {
                    x: item.x + pageLayout.x,
                    y: item.y + pageLayout.y + centeringOffsetY
                  },
                  size: {
                    width: pageLayout.width,
                    height: pageLayout.height
                  }
                };
              }
              return originalGetRectLocation.call(this, pageNumber, virtualItems, totalContentSize);
            };

            // 2. Patch getVisibleRange: Fix horizontal range calculation using height instead of width
            const originalGetVisibleRange = proto.getVisibleRange;
            proto.getVisibleRange = function(viewport: any, virtualItems: any[], scale: number) {
              const isHorizontal = this.constructor.name === 'HorizontalScrollStrategy';
              if (isHorizontal) {
                const scrollOffset = this.getScrollOffset(viewport);
                const clientSize = this.getClientSize(viewport);
                const viewportStart = scrollOffset;
                const viewportEnd = scrollOffset + clientSize;
                
                let startIndex = 0;
                while (startIndex < virtualItems.length) {
                  const item = virtualItems[startIndex];
                  if ((item.offset + item.width) * scale > viewportStart) {
                    break;
                  }
                  startIndex++;
                }
                
                let endIndex = startIndex;
                while (endIndex < virtualItems.length) {
                  const item = virtualItems[endIndex];
                  if (item.offset * scale > viewportEnd) {
                    break;
                  }
                  endIndex++;
                }
                
                return {
                  start: Math.max(0, startIndex - this.bufferSize),
                  end: Math.min(virtualItems.length - 1, endIndex + this.bufferSize - 1)
                };
              }
              return originalGetVisibleRange.call(this, viewport, virtualItems, scale);
            };
          }
        }
        return strategy;
      };
    }
    
    return pluginInstance;
  };
}

// ---------------------------------------------------------------------------
// SpreadPlugin — custom plugin to natively support page pairing (spreads)
// in @embedpdf's scroll plugin.
// ---------------------------------------------------------------------------
class SpreadPlugin extends BasePlugin {
  static id = "spread";
  private twoPageMode = false;
  private listeners: Set<(event: { documentId: string }) => void> = new Set();

  constructor(id: string, registry: any) {
    super(id, registry);
  }

  async initialize(): Promise<void> {
    // No-op custom initialization
  }

  setTwoPageMode(enabled: boolean, documentId: string) {
    if (this.twoPageMode !== enabled) {
      this.twoPageMode = enabled;
      this.listeners.forEach((listener) => {
        try {
          listener({ documentId });
        } catch (e) {
          console.error('[SpreadPlugin] Error invoking spread listener:', e);
        }
      });
    }
  }

  getTwoPageMode() {
    return this.twoPageMode;
  }

  buildCapability() {
    return {
      forDocument: (documentId: string) => ({
        getSpreadPages: () => {
          const coreDoc = (this as any).coreState?.core?.documents?.[documentId];
          const pages = coreDoc?.document?.pages || [];
          if (!pages.length) return [];
          
          if (!this.twoPageMode) {
            return pages.map((page: any) => [page]);
          }
          
          // Group into pairs
          const spreads: any[][] = [];
          for (let i = 0; i < pages.length; i += 2) {
            const pair = [pages[i]];
            if (i + 1 < pages.length) pair.push(pages[i + 1]);
            spreads.push(pair);
          }
          return spreads;
        }
      }),
      onSpreadChange: (callback: (event: { documentId: string }) => void) => {
        this.listeners.add(callback);
        return () => {
          this.listeners.delete(callback);
        };
      }
    };
  }
}

const SpreadPluginPackage = {
  manifest: {
    id: "spread",
    name: "Spread Plugin",
    version: "1.0.0",
    provides: ["spread"],
    requires: [],
    optional: [],
    defaultConfig: {},
  },
  create: (registry: any) => new SpreadPlugin("spread", registry),
  reducer: (state: any = null, action: any) => state,
  initialState: (coreState: any) => null,
};

const useSpreadPlugin = () => usePlugin("spread");
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fillable forms (AcroForm) — @embedpdf/plugin-form
//
// The annotation layer renders a widget with its interactive "fill mode"
// (text input, checkbox, dropdown…) only while the widget is category-locked
// — unlocked, the same widget is rendered in "design mode" (draggable,
// resizable field box), and the form field tools can place new fields.
// EmbedPDF's own viewer keeps the 'form' category locked by default and
// unlocks it only in its Form (design) mode; so do we. The 'form' part of the
// lock is owned here — driven by the enableFormDesign prop — and folded into
// whatever mode the consumer passes to setLocked() (see resolveLock).
// ---------------------------------------------------------------------------
const FORM_FILL_LOCK = { type: AnnotationLockModeType.Include, categories: ["form"] };

// Normalizes a consumer lock mode. The numeric values from ./lock-types never
// matched the plugin's string enum, so they never locked anything — keep that
// behaviour (treat them as None) instead of silently changing what they do.
const normalizeLock = (mode: any): any => {
  switch (mode?.type) {
    case AnnotationLockModeType.All:
    case AnnotationLockModeType.Include:
    case AnnotationLockModeType.Exclude:
      return mode;
    default:
      return { type: AnnotationLockModeType.None };
  }
};

const resolveLock = (requested: any, formDesign: boolean): any => {
  const mode = normalizeLock(requested);
  const others = (mode.categories ?? []).filter((c: string) => c !== "form");
  switch (mode.type) {
    case AnnotationLockModeType.All:
      return mode;
    case AnnotationLockModeType.Include:
      if (formDesign) return others.length ? { ...mode, categories: others } : { type: AnnotationLockModeType.None };
      return { ...mode, categories: [...others, "form"] };
    case AnnotationLockModeType.Exclude:
      return { ...mode, categories: formDesign ? [...others, "form"] : others };
    default:
      return formDesign ? mode : FORM_FILL_LOCK;
  }
};

// Form field (AcroForm) tools registered by @embedpdf/plugin-form.
export type FormFieldToolType = "text" | "checkbox" | "radio" | "dropdown" | "listbox";
const FORM_FIELD_TOOL_IDS: Record<FormFieldToolType, string> = {
  text: "formTextField",
  checkbox: "formCheckbox",
  radio: "formRadioButton",
  dropdown: "formCombobox",
  listbox: "formListbox",
};
const isFormFieldToolId = (id: string | null | undefined) =>
  !!id && Object.values(FORM_FIELD_TOOL_IDS).includes(id);

// True while the host has put the viewer in form edit mode.
const FormEditingContext = createContext(false);

// View mode: the field shows its value but can't be focused or changed.
// Edit mode: the field is interactive and highlighted, so users can see where
// to type — except fields the PDF itself marks read-only.
//
// `inert` blocks pointer and keyboard interaction for the whole subtree —
// the fill-mode components set `pointer-events: auto` on themselves, so a
// plain `pointer-events: none` wrapper would not stop them. It's toggled
// through the ref because React 18 and 19 disagree on how the attribute is
// typed; the wrapper stays the same element in both modes, so the ref must
// both add and remove it.
const FormFillGate = ({ fieldReadOnly, children }: { fieldReadOnly: boolean; children: ReactNode }) => {
  const editing = useContext(FormEditingContext);
  const setInert = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (editing) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [editing]);

  return (
    <div ref={setInert} style={{ position: "relative", width: "100%", height: "100%" }}>
      {children}
      {editing && !fieldReadOnly && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundColor: "rgba(37, 99, 235, 0.08)",
            boxShadow: "inset 0 0 0 1px rgba(37, 99, 235, 0.7)",
          }}
        />
      )}
    </div>
  );
};

// Field labels (see layoutLabel), keyed by field id, and page widths — for
// FieldLabelOverlay.
const FormLabelsContext = createContext<{ labels: Record<string, string>; pageWidths: Record<number, number> }>({
  labels: {},
  pageWidths: {},
});

// Draws a field's label next to it, as part of the field's own rendering:
// the annotation layer positions a field from its live rect, so the label
// moves and resizes together with the field while it's being dragged. (The
// label annotation itself isn't drawn in the viewer — see
// hiddenFieldLabelRenderer — it's what gets flattened into the saved file.)
const FieldLabelOverlay = ({ widget, scale }: { widget: any; scale: number }) => {
  const { labels, pageWidths } = useContext(FormLabelsContext);
  const text = widget?.id ? labels[widget.id] : undefined;
  if (!text || !widget?.rect) return null;
  const layout = layoutLabel(widget, text, pageWidths[widget.pageIndex] ?? Number.MAX_SAFE_INTEGER);
  const { origin, size } = layout.rect;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: (origin.x - widget.rect.origin.x) * scale,
        top: (origin.y - widget.rect.origin.y) * scale,
        width: size.width * scale,
        height: size.height * scale,
        display: "flex",
        alignItems: layout.verticalAlign === PdfVerticalAlignment.Bottom ? "flex-end" : "center",
        justifyContent: layout.textAlign === PdfTextAlignment.Right ? "flex-end" : "flex-start",
        fontFamily: "Helvetica, Arial, sans-serif",
        fontSize: layout.fontSize * scale,
        lineHeight: 1,
        color: "#000000",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {text}
    </div>
  );
};

const withFieldLabel = (content: ReactNode, props: any) => (
  <>
    {content}
    <FieldLabelOverlay widget={props.currentObject} scale={props.scale} />
  </>
);

const lockableFormRenderers = formRenderers.map((renderer: any) => ({
  ...renderer,
  render: (props: any) => withFieldLabel(renderer.render(props), props),
  ...(renderer.renderLocked
    ? {
        renderLocked: (props: any) =>
          withFieldLabel(
            <FormFillGate fieldReadOnly={Boolean((props.currentObject?.field?.flag ?? 0) & PDF_FORM_FIELD_FLAG.READONLY)}>
              {renderer.renderLocked(props)}
            </FormFillGate>,
            props,
          ),
      }
    : {}),
}));

// Field label annotations are drawn by FieldLabelOverlay instead; claim them
// before the built-in FreeText renderer and draw nothing.
const hiddenFieldLabelRenderer = createRenderer({
  id: "cmFormFieldLabel",
  matches: (annotation: any) => isFormFieldLabel(annotation),
  render: () => null,
  hiddenWhenLocked: true,
  useAppearanceStream: false,
} as any);

const FormRendererRegistration = () => {
  useRegisterRenderers([hiddenFieldLabelRenderer, ...lockableFormRenderers]);
  return null;
};

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

const FIELD_KINDS: Partial<Record<PDF_FORM_FIELD_TYPE, FormFieldKind>> = {
  [PDF_FORM_FIELD_TYPE.TEXTFIELD]: "text",
  [PDF_FORM_FIELD_TYPE.CHECKBOX]: "checkbox",
  [PDF_FORM_FIELD_TYPE.RADIOBUTTON]: "radio",
  [PDF_FORM_FIELD_TYPE.COMBOBOX]: "dropdown",
  [PDF_FORM_FIELD_TYPE.LISTBOX]: "listbox",
};

const toFieldDetails = (widget: any, label = ""): FormFieldDetails => {
  const field = widget.field ?? {};
  const flag = field.flag ?? 0;
  return {
    annotationId: widget.id,
    pageIndex: widget.pageIndex,
    kind: FIELD_KINDS[field.type as PDF_FORM_FIELD_TYPE] ?? "other",
    name: field.name ?? "",
    value: field.value ?? "",
    ...(field.maxLen ? { maxLen: field.maxLen } : {}),
    ...(Array.isArray(field.options) ? { options: field.options.map((o: any) => ({ label: o.label, isSelected: !!o.isSelected })) } : {}),
    readOnly: !!(flag & PDF_FORM_FIELD_FLAG.READONLY),
    required: !!(flag & PDF_FORM_FIELD_FLAG.REQUIRED),
    multiline: !!(flag & PDF_FORM_FIELD_FLAG.TEXT_MULTIPLINE),
    comb: !!(flag & PDF_FORM_FIELD_FLAG.TEXT_COMB),
    multiSelect: !!(flag & PDF_FORM_FIELD_FLAG.CHOICE_MULTL_SELECT),
    label,
  };
};

// ---------------------------------------------------------------------------
// Field labels
//
// A label is a FreeText annotation linked to its field (custom marker below)
// and placed just before it: right-aligned, ending LABEL_GAP points left of
// the field — or above the field when there's no room on its left. It's
// read-only on the page (edited through updateField({ label })), follows the
// field when it's moved or resized, and is deleted with it. getFilledPdf()
// flattens labels into page content, so the saved form has printed labels
// rather than annotations.
// ---------------------------------------------------------------------------
export const FORM_FIELD_LABEL_MARKER = "cmFormFieldLabel";
// Space between the end of the label and the field, in points.
const LABEL_GAP = 10;

// Helvetica advance widths (1/1000 em) for ASCII 32–126, from the standard
// Adobe font metrics — PDFium draws the standard Helvetica font (or a
// metric-compatible substitute), so this measures labels exactly.
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0–9 : ; < = > ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ A–O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P–Z [ \ ] ^ _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` a–o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p–z { | } ~
];

const measureHelvetica = (text: string, fontSize: number) => {
  let units = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Characters outside ASCII: assume a wide glyph rather than clip it.
    units += code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32]! : 667;
  }
  return (units / 1000) * fontSize;
};

// "Name" → "Name :" (a colon the user typed isn't doubled).
const formatLabelText = (text: string) => `${text.trim().replace(/[\s:]+$/, "")} :`;

export const isFormFieldLabel = (annotation: any) => !!annotation?.custom?.[FORM_FIELD_LABEL_MARKER];

// The label as the user typed it (without the " :" added for display).
const labelTextOf = (label: any): string =>
  label ? (label.custom?.labelText ?? String(label.contents ?? "").replace(/\s*:\s*$/, "")) : "";

const layoutLabel = (widget: any, text: string, pageWidth: number) => {
  const fontSize = widget.fontSize >= 6 && widget.fontSize <= 20 ? widget.fontSize : 11;
  const lineHeight = Math.ceil(fontSize * 1.6);
  // Measured text plus room for the margin PDFium keeps inside a FreeText
  // box; right-aligned, so any slack ends up on the label's left.
  const width = Math.ceil(measureHelvetica(text, fontSize) + fontSize * 0.6 + 6);
  const { origin, size } = widget.rect;
  // Single-line fields: centre on the field. Tall ones (list boxes,
  // multi-line text): align with their first line.
  const height = size.height <= lineHeight * 1.5 ? size.height : lineHeight;

  if (origin.x - LABEL_GAP - width >= 0) {
    return {
      fontSize,
      rect: { origin: { x: origin.x - LABEL_GAP - width, y: origin.y }, size: { width, height } },
      textAlign: PdfTextAlignment.Right,
      verticalAlign: PdfVerticalAlignment.Middle,
    };
  }
  const aboveY = origin.y - lineHeight - 2;
  if (aboveY >= 0) {
    return {
      fontSize,
      rect: { origin: { x: origin.x, y: aboveY }, size: { width: Math.min(Math.max(width, size.width), pageWidth - origin.x), height: lineHeight } },
      textAlign: PdfTextAlignment.Left,
      verticalAlign: PdfVerticalAlignment.Bottom,
    };
  }
  return {
    fontSize,
    rect: { origin: { x: 0, y: origin.y }, size: { width: Math.max(origin.x - LABEL_GAP, 10), height } },
    textAlign: PdfTextAlignment.Right,
    verticalAlign: PdfVerticalAlignment.Middle,
  };
};

// Applies FormFieldChanges to a widget's field (flag bits, maxLen, options…).
const applyFieldChanges = (field: any, changes: FormFieldChanges) => {
  let flag = field.flag ?? 0;
  const setFlag = (bit: number, on: boolean | undefined) => {
    if (on === undefined) return;
    flag = on ? flag | bit : flag & ~bit;
  };
  setFlag(PDF_FORM_FIELD_FLAG.READONLY, changes.readOnly);
  setFlag(PDF_FORM_FIELD_FLAG.REQUIRED, changes.required);
  setFlag(PDF_FORM_FIELD_FLAG.TEXT_MULTIPLINE, changes.multiline);
  setFlag(PDF_FORM_FIELD_FLAG.TEXT_COMB, changes.comb);
  setFlag(PDF_FORM_FIELD_FLAG.CHOICE_MULTL_SELECT, changes.multiSelect);

  const next: any = { ...field };
  if (changes.value !== undefined) next.value = changes.value;
  if (changes.options !== undefined) next.options = changes.options.map((o) => ({ label: o.label, isSelected: !!o.isSelected }));
  if (changes.maxLen !== undefined) {
    const maxLen = changes.maxLen && changes.maxLen > 0 ? Math.floor(changes.maxLen) : undefined;
    next.maxLen = maxLen;
    // Comb spreads the characters over maxLen boxes — meaningless without it.
    if (!maxLen) flag &= ~PDF_FORM_FIELD_FLAG.TEXT_COMB;
  }
  next.flag = flag;
  return next;
};

// ---------------------------------------------------------------------------

type AnnotationSelectionMenu = (props: {
  annotation: any;
  selected: boolean;
  rect: any;
  menuWrapperProps: {
    style?: CSSProperties;
    [key: string]: any;
  };
}) => ReactElement;

// Import extracted components and utilities
import {
  loadImageDimensions,
  useStampTool,
  createAnnotationAPI,
} from "./components";

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
  style?: React.CSSProperties;
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

// Helper component to handle password logic without side-effects in render
const PasswordLogic = ({ documentState, documentId, onPasswordRequest, onPasswordAccepted }: { documentState: any; documentId: string; onPasswordRequest?: (fileName?: string, isRetry?: boolean) => Promise<string | null>; onPasswordAccepted?: (password: string) => void }) => {
  const { provides } = useDocumentManagerCapability();
  const isHandlingPasswordRef = useRef<boolean>(false);
  const hasHandledInitialRef = useRef<boolean>(false);

  // Helper function to prompt for password and retry
  const promptAndRetry = useCallback((fileName: string, isRetry: boolean) => {
    if (!provides || !onPasswordRequest) return;

    isHandlingPasswordRef.current = true;
    console.log(`[PasswordLogic] ${isRetry ? 'Wrong password, prompting again' : 'Password required'} for:`, fileName);

    onPasswordRequest(fileName, isRetry).then(password => {
      if (password) {
        console.log('[PasswordLogic] Attempting with password...');
        const task = provides.retryDocument(documentId, { password });

        // Use the Task's wait method to detect success/failure
        task.wait(
          // Success callback
          () => {
            console.log('[PasswordLogic] Password accepted!');
            isHandlingPasswordRef.current = false;
            hasHandledInitialRef.current = false;
            onPasswordAccepted?.(password);
          },
          // Error callback - wrong password, prompt again
          (error: any) => {
            console.log('[PasswordLogic] Password rejected, error:', error);
            isHandlingPasswordRef.current = false;
            // Recursively prompt again
            promptAndRetry(fileName, true);
          }
        );
      } else {
        console.log('[PasswordLogic] No password provided (cancelled)');
        isHandlingPasswordRef.current = false;
      }
    });
  }, [provides, onPasswordRequest, onPasswordAccepted, documentId]);

  useEffect(() => {
    if (!documentState || !onPasswordRequest || !provides) return;

    // Only process if errorCode is Password or isEncrypted is true
    // Cast to any since isEncrypted is a new property in @embedpdf/models@2.2.0
    if (documentState.errorCode !== PdfErrorCode.Password && !(documentState as any).isEncrypted) {
      hasHandledInitialRef.current = false;
      isHandlingPasswordRef.current = false;
      return;
    }

    // Skip if we're already handling a password prompt
    if (isHandlingPasswordRef.current) {
      return;
    }

    // Only handle the initial password request here
    // Subsequent retries are handled by the task.wait() error callback
    if (!hasHandledInitialRef.current && !documentState.passwordProvided) {
      hasHandledInitialRef.current = true;
      promptAndRetry(documentState.name, false);
    } else if (!hasHandledInitialRef.current && documentState.passwordProvided) {
      // This catches the case where the component re-renders with a wrong password state
      hasHandledInitialRef.current = true;
      promptAndRetry(documentState.name, true);
    }
  }, [documentState?.errorCode, documentState?.passwordProvided, documentId, onPasswordRequest, provides, promptAndRetry]);

  return null;
};

/**
 * PDF's `/F` annotation flags bitfield includes a spec-defined "Print" bit
 * (value 4): "If set, print the annotation when the page is printed... If
 * clear, never print the annotation, regardless of whether it is displayed
 * on the screen" (PDF spec, Table 165). This is the actual root cause behind
 * a highlight (or any annotation) rendering correctly on screen and surviving
 * `downloadWithAnnotations` (which just serializes the annotation as-is —
 * nothing there inspects the Print bit) while silently vanishing from every
 * real print operation, `printWithAnnotations` included: any spec-compliant
 * print pipeline — including @embedpdf/plugin-print's own `preparePrintDocument`
 * (PDFium's `FPDF_ImportPages`, which does carry annotations and their flags
 * across correctly — that was never the actual problem) — correctly omits an
 * annotation whose Print bit is clear.
 *
 * `@embedpdf/engines`' native content-writer only defaults *new* STAMP
 * annotations to `annotation.flags || ['print', 'noZoom', 'noRotate']`
 * (its `addStampContent`) — there is no equivalent fallback for the
 * text-markup family (Highlight/Underline/StrikeOut/Squiggly, via
 * `addTextMarkupContent`), and that fallback only triggers when `flags` is
 * missing entirely, not when it's an empty array (`[]` is truthy in JS, so
 * `annotation.flags && setAnnotationFlags(...)` still fires and writes zero
 * bits — Print included). Once any caller (a consuming app's own flag
 * management, e.g. computing engine-enforced read-only/locked flags from
 * permissions, is a completely reasonable thing to do) writes a `flags`
 * array via `updateAnnotation` without separately re-adding 'print', the
 * Print bit silently stays or becomes cleared with no path back.
 *
 * Since `updateAnnotation` (below) is the single choke point every
 * flags-bearing patch — from any consumer, for any reason — passes through,
 * this guarantees 'print' survives by default unless the annotation is
 * being made invisible anyway ('hidden' / 'noView'), in which case whether
 * it would print is moot.
 */
const ensurePrintableFlags = (flags: unknown): unknown => {
  if (!Array.isArray(flags)) return flags;
  if (flags.includes('hidden') || flags.includes('noView')) return flags;
  if (flags.includes('print')) return flags;
  return [...flags, 'print'];
};

// Internal component that has access to plugin hooks
// ... (PDFContent definition continues)
const PDFContent = forwardRef<PDFViewerRef, {
  isReady: boolean;
  isLoading: boolean;
  hasPassword: boolean;
  annotationSelectionMenu?: AnnotationSelectionMenu;
  pdfBuffer?: Uint8Array | null;
  engine: any;
  documentId: string;
  userDetails?: { name?: string; email?: string; id?: string;[key: string]: any };
  onPasswordRequest?: (fileName?: string) => Promise<string | null>;
  hideInternalLoading?: boolean;
  twoPageMode?: boolean | undefined;
  scrollStrategy?: ScrollStrategy | undefined;
  onPageChange?: ((page: number) => void) | undefined;
  enableFormFilling: boolean;
  enableFormDesign: boolean;
  onFormFieldSelect?: ((field: FormFieldDetails | null) => void) | undefined;
  onFormStateChange?: ((state: PDFFormState) => void) | undefined;
}>(({
  isReady,
  isLoading,
  hasPassword,
  annotationSelectionMenu,
  pdfBuffer,
  engine,
  documentId,
  userDetails,
  onPasswordRequest,
  hideInternalLoading,
  twoPageMode,
  scrollStrategy,
  onPageChange,
  enableFormFilling,
  enableFormDesign,
  onFormFieldSelect,
  onFormStateChange,
}, ref) => {
  // v2.x hooks now require documentId for multi-document support
  const zoom = useZoom(documentId);
  const search = useSearch(documentId);
  const scroll = useScroll(documentId);
  const rotate = useRotate(documentId);
  const annotation = useAnnotationCapability();
  const print = usePrintCapability();
  const documentManager = useDocumentManagerCapability(); // documentManager capability used in PasswordLogic
  const selection = useSelectionCapability();
  const docState = useDocumentState(documentId);
  const { plugin: spreadPlugin } = useSpreadPlugin() as any;
  const { provides: formCapability } = useFormCapability();
  const { plugin: formPlugin } = useFormPlugin();

  // Every field edit is written into the document asynchronously (one write
  // per keystroke for text fields). Count the writes in flight so
  // getFilledPdf() can wait for them — otherwise a save right after typing
  // can read the document before the last characters have landed.
  const pendingFormWritesRef = useRef(0);
  const formWritesIdleRef = useRef<Array<() => void>>([]);
  useEffect(() => {
    const plugin = formPlugin as any;
    if (!plugin) return undefined;
    const track = (method: string) => {
      const original = plugin[method];
      if (typeof original !== "function") return () => undefined;
      plugin[method] = function (this: unknown, ...args: unknown[]) {
        const task = original.apply(this, args);
        pendingFormWritesRef.current += 1;
        const settle = () => {
          pendingFormWritesRef.current -= 1;
          if (pendingFormWritesRef.current === 0) {
            const waiters = formWritesIdleRef.current;
            formWritesIdleRef.current = [];
            waiters.forEach((resolve) => resolve());
          }
        };
        if (typeof task?.wait === "function") task.wait(settle, settle);
        else settle();
        return task;
      };
      // The plugin's scopes call `this.<method>` at call time, so wrapping the
      // instance catches every write; deleting the wrapper restores the
      // prototype method.
      return () => {
        delete plugin[method];
      };
    };
    const untrack = [track("setFormFieldValues"), track("setFormValuesMethod")];
    return () => untrack.forEach((restore) => restore());
  }, [formPlugin]);

  const waitForFormWrites = useCallback(() => {
    if (pendingFormWritesRef.current === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      formWritesIdleRef.current.push(resolve);
      // Never let a stuck write block saving forever.
      setTimeout(resolve, 10000);
    });
  }, []);

  // Form fill state. The baseline is what "not dirty" means: the values the
  // document loaded with, or the values at the last markFormSaved().
  const formBaselineRef = useRef<{ fieldCount: number; values: Record<string, string> | null } | null>(null);
  const formStateRef = useRef<PDFFormState>({ hasFormFields: false, fieldCount: 0, isDirty: false });
  const onFormStateChangeRef = useRef(onFormStateChange);
  onFormStateChangeRef.current = onFormStateChange;
  // Needed to re-open the original bytes in getFilledPdf() for encrypted files.
  const acceptedPasswordRef = useRef<string | undefined>(undefined);
  const handlePasswordAccepted = useCallback((password: string) => {
    acceptedPasswordRef.current = password;
  }, []);
  // Consumer-requested lock mode, returned as-is by getLocked().
  const requestedLockRef = useRef<LockMode | null>(null);

  // Ids of annotations that are not part of the original file: imported by
  // the host through importAnnotations() (e.g. from its own database) or
  // drawn in the viewer. getFilledPdf() leaves these out of the saved file.
  // Imports don't emit annotation events, so they're recorded where they
  // pass through importAnnotations() below.
  const addedAnnotationIdsRef = useRef<Set<string>>(new Set());
  // Ids of form field widgets deleted in the viewer — when there are any,
  // getFilledPdf() also removes them from the form's field tree (PDFium only
  // takes them off the page).
  const deletedFieldWidgetIdsRef = useRef<Set<string>>(new Set());
  // Field id → id of its label annotation (see layoutLabel).
  const fieldLabelsRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    addedAnnotationIdsRef.current = new Set();
    deletedFieldWidgetIdsRef.current = new Set();
    fieldLabelsRef.current = new Map();
  }, [documentId]);

  const getAnnotationObject = useCallback((annotationId: string): any => {
    return (annotation.provides as any)?.getState?.()?.byUid?.[annotationId]?.object ?? null;
  }, [annotation.provides]);

  const getFieldLabel = useCallback((fieldId: string): any => {
    const labelId = fieldLabelsRef.current.get(fieldId);
    if (!labelId) return null;
    const label = getAnnotationObject(labelId);
    if (!label) fieldLabelsRef.current.delete(fieldId);
    return label;
  }, [getAnnotationObject]);

  // Creates, updates or (for empty text) removes the label of a field.
  const setFieldLabel = useCallback((widget: any, text: string) => {
    const cap = annotation.provides as any;
    if (!cap) return;
    const existing = getFieldLabel(widget.id);
    const trimmed = text.trim();
    if (!trimmed) {
      if (existing) {
        // deleteAnnotation() always clears the selection — keep the field
        // selected (its properties panel open) when only its label goes.
        const wasSelected = cap.getSelectedAnnotation?.()?.object?.id === widget.id;
        cap.deleteAnnotation(existing.pageIndex, existing.id);
        cap.commit?.();
        if (wasSelected) cap.selectAnnotation?.(widget.pageIndex, widget.id);
      }
      fieldLabelsRef.current.delete(widget.id);
      return;
    }
    const pageWidth = docState?.document?.pages?.[widget.pageIndex]?.size?.width ?? Number.MAX_SAFE_INTEGER;
    // Shown as "Label :"; the text as typed is kept in custom.labelText.
    const contents = formatLabelText(trimmed);
    const layout = layoutLabel(widget, contents, pageWidth);
    const custom = { [FORM_FIELD_LABEL_MARKER]: true, fieldId: widget.id, labelText: trimmed };
    if (existing) {
      cap.updateAnnotation(existing.pageIndex, existing.id, { contents, custom, ...layout });
    } else {
      const id = `label-${widget.id}-${Math.random().toString(36).slice(2, 9)}`;
      fieldLabelsRef.current.set(widget.id, id);
      cap.createAnnotation(widget.pageIndex, {
        type: PdfAnnotationSubtype.FREETEXT,
        id,
        pageIndex: widget.pageIndex,
        contents,
        fontFamily: PdfStandardFont.Helvetica,
        fontColor: '#000000',
        opacity: 1,
        flags: ['print', 'readOnly'],
        custom,
        ...layout,
      });
    }
    cap.commit?.();
  }, [annotation.provides, getFieldLabel, docState]);

  useEffect(() => {
    const off = (annotation.provides as any)?.onAnnotationEvent?.((event: any) => {
      const ann = event?.annotation;
      if (!ann?.id) return;
      if (ann.type === PdfAnnotationSubtype.WIDGET) {
        const fieldId = String(ann.id);
        if (event.type === 'delete') {
          deletedFieldWidgetIdsRef.current.add(fieldId);
          // The label goes with its field.
          const label = getFieldLabel(fieldId);
          if (label) {
            const cap = annotation.provides as any;
            cap?.deleteAnnotation(label.pageIndex, label.id);
            cap?.commit?.();
          }
          fieldLabelsRef.current.delete(fieldId);
        } else if (event.type === 'update' && fieldLabelsRef.current.has(fieldId)) {
          // Keep the label next to a moved / resized field. Read the field
          // after the plugin has applied the update to its state.
          setTimeout(() => {
            const widget = getAnnotationObject(fieldId);
            const label = getFieldLabel(fieldId);
            if (widget?.type === PdfAnnotationSubtype.WIDGET && label) setFieldLabel(widget, labelTextOf(label));
          }, 0);
        }
        return;
      }
      if (event.type === 'create' && !isFormFieldLabel(ann)) addedAnnotationIdsRef.current.add(String(ann.id));
    });
    return () => off?.();
  }, [annotation.provides, getFieldLabel, getAnnotationObject, setFieldLabel]);

  // Label text by field id, for FieldLabelOverlay (which draws the labels in
  // the viewer, attached to their fields).
  const [formLabels, setFormLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    const cap = annotation.provides as any;
    if (!cap?.onStateChange) return undefined;
    const refresh = () => {
      const next: Record<string, string> = {};
      fieldLabelsRef.current.forEach((labelId, fieldId) => {
        const label = getAnnotationObject(labelId);
        if (label?.contents) next[fieldId] = label.contents;
      });
      setFormLabels((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    const off = cap.onStateChange(refresh);
    refresh();
    return () => off?.();
  }, [annotation.provides, getAnnotationObject, documentId]);
  const formLabelsContext = useMemo(() => {
    const pageWidths: Record<number, number> = {};
    (docState?.document?.pages ?? []).forEach((page: any) => {
      pageWidths[page.index] = page.size?.width;
    });
    return { labels: formLabels, pageWidths };
  }, [formLabels, docState?.document]);

  // The form field selected in design mode (fields can only be selected
  // there — in fill mode they're locked). Re-published when its properties
  // change, so a properties panel stays in sync.
  const selectedFieldRef = useRef<FormFieldDetails | null>(null);
  const onFormFieldSelectRef = useRef(onFormFieldSelect);
  onFormFieldSelectRef.current = onFormFieldSelect;
  useEffect(() => {
    const cap = annotation.provides as any;
    if (!cap?.onStateChange) return undefined;
    const publish = () => {
      const selected = cap.getSelectedAnnotation?.()?.object;
      const next = selected?.type === PdfAnnotationSubtype.WIDGET && selected.field
        ? toFieldDetails(selected, labelTextOf(getFieldLabel(selected.id)))
        : null;
      if (JSON.stringify(next) === JSON.stringify(selectedFieldRef.current)) return;
      selectedFieldRef.current = next;
      onFormFieldSelectRef.current?.(next);
    };
    const off = cap.onStateChange(publish);
    publish();
    return () => {
      off?.();
      if (selectedFieldRef.current) {
        selectedFieldRef.current = null;
        onFormFieldSelectRef.current?.(null);
      }
    };
  }, [annotation.provides, documentId, getFieldLabel]);

  const findWidget = useCallback((annotationId: string): any => {
    const cap = annotation.provides as any;
    const tracked = cap?.getState?.()?.byUid?.[annotationId];
    const object = tracked?.object;
    return object?.type === PdfAnnotationSubtype.WIDGET ? object : null;
  }, [annotation.provides]);
  const enableFormDesignRef = useRef(enableFormDesign);
  enableFormDesignRef.current = enableFormDesign;

  // Single place the annotation lock is applied: the consumer's requested
  // mode with the 'form' category locked (fill) or unlocked (design).
  const applyLock = useCallback(() => {
    const cap = annotation.provides as any;
    cap?.setLocked?.(resolveLock(requestedLockRef.current, enableFormDesignRef.current));
  }, [annotation.provides]);

  useEffect(() => {
    applyLock();
    if (!enableFormDesign) {
      // A field tool left armed would keep placing fields that then render
      // in fill mode — disarm it when design mode ends.
      const cap = annotation.provides as any;
      if (isFormFieldToolId(cap?.getActiveTool?.()?.id)) {
        cap.setActiveTool(null);
      }
    }
  }, [enableFormDesign, applyLock, annotation.provides, documentId]);

  // Set when a field is added, moved, resized or removed (design mode) —
  // changes that don't show up in the field count or values alone.
  const formStructureChangedRef = useRef(false);

  const publishFormState = useCallback(() => {
    if (!formCapability) return;
    const scope = formCapability.forDocument(documentId);
    const fieldCount = scope.getFormFields().length;
    const values = scope.getFormValues();
    const next: PDFFormState = {
      hasFormFields: fieldCount > 0,
      fieldCount,
      isDirty: formStructureChangedRef.current
        || fieldCount !== formBaselineRef.current?.fieldCount
        || !sameFormValues(formBaselineRef.current?.values || null, values),
    };
    const prev = formStateRef.current;
    formStateRef.current = next;
    if (prev.hasFormFields !== next.hasFormFields || prev.fieldCount !== next.fieldCount || prev.isDirty !== next.isDirty) {
      onFormStateChangeRef.current?.(next);
    }
  }, [formCapability, documentId]);

  useEffect(() => {
    if (!formCapability) return undefined;
    const scope = formCapability.forDocument(documentId);
    formStructureChangedRef.current = false;
    formBaselineRef.current = {
      fieldCount: scope.getFormFields().length,
      values: scope.getFormFields().length > 0 ? scope.getFormValues() : null,
    };
    formStateRef.current = { hasFormFields: false, fieldCount: 0, isDirty: false };
    publishFormState();

    const offReady = scope.onFormReady(() => {
      formBaselineRef.current = {
        fieldCount: scope.getFormFields().length,
        values: scope.getFormValues(),
      };
      publishFormState();
    });
    const offChange = scope.onFieldValueChange(() => publishFormState());
    // Fields added, moved or removed in design mode arrive as widget
    // annotation events. The form plugin rebuilds its field index in its own
    // listener for the same event, so read the fields after it has run.
    const offWidgets = (annotation.provides as any)?.onAnnotationEvent?.((event: any) => {
      if (event?.annotation?.type !== PdfAnnotationSubtype.WIDGET) return;
      if (event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        formStructureChangedRef.current = true;
      }
      setTimeout(publishFormState, 0);
    });
    return () => {
      offReady();
      offChange();
      offWidgets?.();
    };
  }, [formCapability, documentId, publishFormState, annotation.provides]);

  // Track annotations with metadata
  const [annotationsMetadata, setAnnotationsMetadata] = useState<Map<string, any>>(new Map());

  // Track verified totalPages from onLayoutReady event
  // The useScroll hook initializes totalPages to 1, so we need to track when we get the real value
  const [verifiedTotalPages, setVerifiedTotalPages] = useState<number>(0);

  // Use a ref to store the latest verifiedTotalPages for use in useImperativeHandle
  // This avoids stale closure issues where the function captures an old value
  const verifiedTotalPagesRef = useRef<number>(0);

  // Keep ref in sync with state
  useEffect(() => {
    verifiedTotalPagesRef.current = verifiedTotalPages;
  }, [verifiedTotalPages]);

  // Apply two-page mode and scroll strategy from props inside the document context
  useEffect(() => {
    if (spreadPlugin && twoPageMode !== undefined) {
      spreadPlugin.setTwoPageMode(twoPageMode, documentId);
    }
  }, [spreadPlugin, twoPageMode, documentId]);

  useEffect(() => {
    if (scroll.provides && scrollStrategy !== undefined) {
      scroll.provides.setScrollStrategy(scrollStrategy);
    }
  }, [scrollStrategy, scroll.provides]);

  // Subscribe to page changes from scrolling inside the document context
  useEffect(() => {
    if (!scroll.provides || !onPageChange) return;
    const unsubscribe = scroll.provides.onPageChange((event) => {
      if (event?.pageNumber) {
        onPageChange(event.pageNumber);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [scroll.provides, onPageChange]);

  // Track pending stamp image for placement
  // Track click-to-place callback
  const clickToPlaceCallbackRef = useRef<((clickData: { pageIndex: number; x: number; y: number; pageWidth?: number; pageHeight?: number; target?: HTMLElement | EventTarget }) => void) | null>(null);
  const customStampToolIdRef = useRef<string | null>(null);
  const stampSizeCacheRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  const currentUserInfoRef = useRef<{ author?: string; customData?: any } | null>(null);
  const [annotationRenderVersion, setAnnotationRenderVersion] = useState(0);

  useEffect(() => {
    customStampToolIdRef.current = null;
    stampSizeCacheRef.current.clear();
    if (annotation.provides) {
      annotation.provides.setActiveTool(null);
    }
  }, [pdfBuffer]);

  // Annotations already baked into a freshly-opened PDF are added to plugin
  // state in bulk during document load — unlike interactively-placed ones,
  // no 'create' event fires for them. Tools that paint via the JS layer
  // instead of a native appearance stream (e.g. the built-in "stamp" tool —
  // see its useAppearanceStream: false) render their visible content by
  // asynchronously rasterizing the annotation through the engine
  // (RenderAnnotation in @embedpdf/plugin-annotation's react bindings) and
  // swallow any failure silently (`.wait(onSuccess, ignore)` — ignore is a
  // literal no-op from @embedpdf/models). If that first rasterize races the
  // engine/page not being fully ready yet right after document load, the
  // annotation is left permanently blank — only its selection/hover chrome
  // (border, delete button) still works, since that's a separate layer.
  // Selecting the annotation happens to remount it and retry, which is why
  // clicking makes it appear. Force the same remount (already used
  // elsewhere in this file after importAnnotations()/stamp activation)
  // ourselves once loaded annotations appear, and again after a short delay
  // as a retry in case that first forced attempt hit the same race.
  useEffect(() => {
    const provides = annotation.provides as any;
    if (!provides?.onStateChange) return undefined;

    let fired = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const checkAndFire = () => {
      if (fired) return;
      const docState = provides.getState?.();
      const hasAnnotations = docState?.byUid && Object.keys(docState.byUid).length > 0;
      if (!hasAnnotations) return;
      fired = true;
      setAnnotationRenderVersion((v) => v + 1);
      retryTimer = setTimeout(() => setAnnotationRenderVersion((v) => v + 1), 500);
    };

    const unsubscribe = provides.onStateChange(checkAndFire);
    checkAndFire(); // covers the case where annotations are already loaded by the time we subscribe

    return () => {
      unsubscribe?.();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [annotation.provides, documentId]);

  // Update user info ref when userDetails change
  useEffect(() => {
    if (userDetails) {
      currentUserInfoRef.current = {
        author: userDetails.name || userDetails.email || 'Guest',
        customData: userDetails
      };
    }
  }, [userDetails]);

  // Guarantee every newly-created annotation is printable by default (see
  // ensurePrintableFlags' doc comment above the component). Catches the case
  // before any app-level flags-management call (e.g. a consumer computing
  // engine-enforced read-only/locked flags from its own permission model, or
  // this component's own note-placement locking just below) ever runs — so
  // even an unsaved draft downloads/prints correctly, not just saved ones.
  useEffect(() => {
    if (!annotation.provides?.onAnnotationEvent) return undefined;

    const unsubscribe = annotation.provides.onAnnotationEvent((event: any) => {
      if (event?.type !== 'create' || event?.committed === false) return;
      const ann = event.annotation;
      if (!ann?.id) return;

      const currentFlags = Array.isArray(ann.flags) ? ann.flags : [];
      const patched = ensurePrintableFlags(currentFlags) as string[];
      if (patched === currentFlags) return; // already printable, or deliberately hidden

      const api = annotation.provides as any;
      if (typeof api?.updateAnnotation !== 'function') return;
      api.updateAnnotation(ann.pageIndex, ann.id, { flags: patched });
      if (typeof api.commit === 'function') {
        api.commit();
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [annotation.provides]);

  // Handle Ctrl+C for copying selected text
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Check for Ctrl+C or Cmd+C (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selection.provides) {
          try {
            const textArray = await selection.provides.getSelectedText().toPromise();
            const text = textArray.join(' ');
            if (text && text.trim()) {
              await navigator.clipboard.writeText(text);
              console.log('Text copied to clipboard:', text);
            }
          } catch (err) {
            console.error('Failed to copy text:', err);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection]);

  // Subscribe to onLayoutReady event to get verified totalPages
  // The useScroll hook initializes totalPages to 1 before the document loads,
  // so we need to listen to onLayoutReady which fires with the correct value
  useEffect(() => {
    // Reset verified total pages when document changes
    setVerifiedTotalPages(0);

    // Access the scroll capability directly for onLayoutReady subscription
    const scrollCapability = scroll.provides;
    if (!scrollCapability) return;

    // Track if we've found the total to avoid stale closure issues
    let foundTotal = false;

    // Try to get totalPages from scroll.provides.getTotalPages() or scroll.state.totalPages
    // after the document is loaded
    const checkTotalPages = () => {
      if (foundTotal) return; // Already found, skip

      // First try scroll.provides.getTotalPages() if it exists
      if (scrollCapability && typeof (scrollCapability as any).getTotalPages === 'function') {
        const total = (scrollCapability as any).getTotalPages();
        if (total > 0) {
          console.log('[PDFContent] Got verified totalPages from scroll capability:', total);
          setVerifiedTotalPages(total);
          foundTotal = true; // Mark as found to stop further polling
          return;
        }
      }

      // Fallback: check scroll.state.totalPages
      // The scroll state initializes totalPages to 1, so we accept any value > 1
      // OR any value that comes from the document after it's been fully loaded
      if (scroll.state && scroll.state.totalPages > 1) {
        console.log('[PDFContent] Got verified totalPages from scroll state:', scroll.state.totalPages);
        setVerifiedTotalPages(scroll.state.totalPages);
        foundTotal = true;
      }
    };

    // Check immediately
    checkTotalPages();

    // Also poll briefly to catch when it becomes available
    const intervalId = setInterval(() => {
      checkTotalPages();
      if (foundTotal) {
        clearInterval(intervalId);
      }
    }, 100);

    // Stop polling after 3 seconds
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
    }, 3000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [scroll.provides, scroll.state, documentId, pdfBuffer]);

  // Reset verified total pages when document changes
  useEffect(() => {
    setVerifiedTotalPages(0);
  }, [documentId]);

  const waitForNextFrame = useCallback(async () => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      return;
    }

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }, []);

  const ensureStampTool = useCallback(async (imageDataUrl: string, userInfo?: { author?: string; customData?: any }) => {
    if (!annotation.provides) {
      return null;
    }

    try {
      console.debug("[PDFViewer] ensureStampTool", { imageDataUrl: imageDataUrl.slice(0, 32), userInfo });
      const cached = stampSizeCacheRef.current.get(imageDataUrl);
      const { width, height } = cached ?? (await loadImageDimensions(imageDataUrl));
      if (!cached) {
        stampSizeCacheRef.current.set(imageDataUrl, { width, height });
      }
      const maxWidth = 200;
      const maxHeight = 200;

      let toolWidth = width;
      let toolHeight = height;

      if (toolWidth > maxWidth) {
        const scale = maxWidth / toolWidth;
        toolWidth = maxWidth;
        toolHeight = Math.round(toolHeight * scale);
      }

      if (toolHeight > maxHeight) {
        const scale = maxHeight / toolHeight;
        toolHeight = maxHeight;
        toolWidth = Math.round(toolWidth * scale);
      }

      const toolId = customStampToolIdRef.current ?? "customStamp";
      const existingTool = annotation.provides.getTool(toolId);

      if (!existingTool) {
        console.debug("[PDFViewer] adding new custom stamp tool", { toolId, width: toolWidth, height: toolHeight, userInfo });
        const defaults: any = {
          type: PdfAnnotationSubtype.STAMP,
          imageSrc: imageDataUrl,
          imageSize: { width: toolWidth, height: toolHeight },
        };

        // Add user information to defaults if provided
        if (userInfo?.author) {
          defaults.author = userInfo.author;
        }
        if (userInfo?.customData) {
          defaults.customData = userInfo.customData;
        }

        annotation.provides.addTool({
          id: toolId,
          name: "Custom Stamp",
          interaction: {
            exclusive: false,
            cursor: "crosshair",
            isRotatable: false,
            // The stamp image is a fixed-aspect-ratio bitmap (generated once at
            // placement) — without this, dragging a single resize handle can
            // stretch the box into different proportions than the image, which
            // the renderer either distorts or crops the text out of. Matching
            // the library's own built-in "stamp" tool here.
            lockAspectRatio: true,
            lockGroupAspectRatio: true,
          },
          // findToolForAnnotation() picks the tool with the highest matchScore,
          // using strict `>` — on a tie it keeps whichever tool was registered
          // first. The library's built-in "stamp" tool (registered before ours)
          // also scores every STAMP annotation as 1, so it was always winning
          // the tie and our own interaction/behavior config was never applied.
          // Score strictly higher so our tool deterministically wins.
          matchScore: () => 2,
          defaults,
        });
        customStampToolIdRef.current = toolId;
      } else {
        console.debug("[PDFViewer] updating existing stamp defaults", { toolId, width: toolWidth, height: toolHeight });
        annotation.provides.setToolDefaults(toolId, {
          imageSrc: imageDataUrl,
          imageSize: { width: toolWidth, height: toolHeight },
        });
        customStampToolIdRef.current = toolId;
      }

      await waitForNextFrame();
      return toolId;
    } catch (error) {
      console.error("Failed to register custom stamp tool", error);
      return null;
    }
  }, [annotation.provides, waitForNextFrame]);

  const waitForActiveTool = useCallback(
    async (toolId: string) => {
      if (!annotation.provides) {
        return false;
      }

      if (annotation.provides.getActiveTool()?.id === toolId) {
        return true;
      }

      if (typeof window === "undefined") {
        return false;
      }

      const win = window;
      const start = win.performance?.now?.() ?? Date.now();

      return await new Promise<boolean>((resolve) => {
        let settled = false;
        const unsubscribe =
          annotation.provides?.onActiveToolChange((tool: any) => {
            if (tool?.id === toolId && !settled) {
              settled = true;
              unsubscribe?.();
              resolve(true);
            }
          }) ?? null;

        const poll = () => {
          if (settled) return;
          if (annotation.provides?.getActiveTool()?.id === toolId) {
            settled = true;
            unsubscribe?.();
            resolve(true);
            return;
          }

          const elapsed = (win.performance?.now?.() ?? Date.now()) - start;
          if (elapsed >= 2000) {
            settled = true;
            unsubscribe?.();
            console.warn(`[PDFViewer] Timed out waiting for tool ${toolId} to activate after ${elapsed.toFixed(0)}ms`);
            resolve(false);
            return;
          }

          win.requestAnimationFrame(poll);
        };

        win.requestAnimationFrame(poll);
      });
    },
    [annotation.provides],
  );

  // Listen for annotation events to track metadata
  useEffect(() => {
    if (!annotation.provides) return;

    const unsubscribe = annotation.provides.onAnnotationEvent((event: any) => {
      if (event.type === 'create') {
        setAnnotationsMetadata((prev) => {
          const newMap = new Map(prev);
          const annotationData = {
            type: event.annotation?.type || 'unknown',
            createdAt: new Date().toISOString(),
            createdBy: userDetails?.name || 'Unknown User',
            userEmail: userDetails?.email || null,
            userId: userDetails?.id || null,
            pageIndex: event.annotation?.pageIndex ?? null,
            rect: event.annotation?.rect || null,
            content: event.annotation?.content || null,
            color: event.annotation?.color || null,
            rawAnnotation: event.annotation,
          };
          newMap.set(event.annotation?.id || `annotation-${Date.now()}`, annotationData);
          return newMap;
        });
      } else if (event.type === 'delete') {
        setAnnotationsMetadata((prev) => {
          const newMap = new Map(prev);
          newMap.delete(event.annotation?.id);
          return newMap;
        });
      } else if (event.type === 'update') {
        setAnnotationsMetadata((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(event.annotation?.id);
          if (existing) {
            newMap.set(event.annotation?.id, {
              ...existing,
              updatedAt: new Date().toISOString(),
              updatedBy: userDetails?.name || 'Unknown User',
              rect: event.annotation?.rect || existing.rect,
              content: event.annotation?.content || existing.content,
              rawAnnotation: event.annotation,
            });
          }
          return newMap;
        });
      }

      // If a form field (Widget) is added/deleted/updated, we need to refresh the form state
      // so the Save Form button enables.
      if (
        event.annotation?.type === PdfAnnotationSubtype.WIDGET ||
        event.annotation?.type === 'Widget'
      ) {
        publishFormState();
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [annotation.provides, userDetails, publishFormState]);

  const performScrollToPage = useCallback((page: number) => {
    if (scroll.provides) {
      scroll.provides.scrollToPage({ pageNumber: page });
    }
  }, [scroll.provides]);

  useImperativeHandle(ref, () => ({
    zoom: {
      zoomIn: () => {
        if (zoom.provides) {
          zoom.provides.zoomIn();
        }
      },
      zoomOut: () => {
        if (zoom.provides) {
          zoom.provides.zoomOut();
        }
      },
      setZoom: (level: number) => {
        if (zoom.provides) {
          zoom.provides.requestZoom(level);
        }
      },
      resetZoom: () => {
        if (zoom.provides) {
          zoom.provides.requestZoom(ZoomMode.FitPage);
        }
      },
      fitToWidth: () => {
        if (zoom.provides) {
          zoom.provides.requestZoom(ZoomMode.FitWidth);
        }
      },
      fitToPage: () => {
        if (zoom.provides) {
          zoom.provides.requestZoom(ZoomMode.FitPage);
        }
      },
      getZoom: () => zoom.state?.zoomLevel || 1.0,
    },
    navigation: {
      goToPage: (page: number) => {
        performScrollToPage(page);
      },
      getCurrentPage: () => {
        if (scroll.state) {
          return scroll.state.currentPage || 1; // Use currentPage property
        }
        return 1;
      },
      getTotalPages: () => {
        // Use ref to get the latest value - avoids stale closure issues
        const currentVerifiedTotal = verifiedTotalPagesRef.current;

        // Use verifiedTotalPages which is set from onLayoutReady/getTotalPages()
        // This avoids the issue where useScroll initializes totalPages to 1
        if (currentVerifiedTotal > 0) {
          return currentVerifiedTotal;
        }
        // Fallback: check if scroll.state has a value > 1 (since 1 is the default)
        if (scroll.state && scroll.state.totalPages > 1) {
          return scroll.state.totalPages;
        }
        return 0; // Return 0 to indicate page count not yet available
      },
      nextPage: () => {
        const currentPage = scroll.state?.currentPage || 1;
        const totalPages = verifiedTotalPages > 0 ? verifiedTotalPages : (scroll.state?.totalPages || 0);
        if (totalPages > 1 && currentPage < totalPages) {
          performScrollToPage(currentPage + 1);
        }
      },
      previousPage: () => {
        const currentPage = scroll.state?.currentPage || 1;
        if (currentPage > 1) {
          performScrollToPage(currentPage - 1);
        }
      },
      goToFirstPage: () => {
        performScrollToPage(1);
      },
      goToLastPage: () => {
        const totalPages = verifiedTotalPages > 0 ? verifiedTotalPages : (scroll.state?.totalPages || 0);
        if (totalPages > 1) {
          performScrollToPage(totalPages);
        }
      },
      setScrollStrategy: (strategy: ScrollStrategy) => {
        if (scroll.provides) {
          scroll.provides.setScrollStrategy(strategy);
        }
      },
      getLayout: () => {
        if (scroll.provides) {
          return scroll.provides.getLayout();
        }
        return null;
      },
      setTwoPageMode: (enabled: boolean) => {
        if (spreadPlugin) {
          spreadPlugin.setTwoPageMode(enabled, documentId);
        }
      },
      getTwoPageMode: () => {
        return spreadPlugin?.getTwoPageMode() ?? false;
      },
      onPageChange: (listener: (event: any) => void) => {
        if (scroll.provides) {
          return scroll.provides.onPageChange(listener);
        }
        return () => {};
      },
    },
    selection: {
      clearSelection: () => {
        if (selection.provides) {
          selection.provides.clear();
        }
      },
      getSelectedText: async () => {
        if (selection.provides) {
          const text = await selection.provides.getSelectedText().toPromise();
          return text.join(' ');
        }
        return '';
      },
      copy: () => {
        if (selection.provides) {
          selection.provides.copyToClipboard();
        }
      },
    },
    search: {
      searchText: async (keyword: string) => {
        if (search.provides) {
          const task = search.provides.searchAllPages(keyword);
          return task.toPromise();
        }
        return null;
      },
      nextResult: () => {
        if (search.provides) {
          return search.provides.nextResult();
        }
        return -1;
      },
      previousResult: () => {
        if (search.provides) {
          return search.provides.previousResult();
        }
        return -1;
      },
      goToResult: (index: number) => {
        if (search.provides) {
          return search.provides.goToResult(index);
        }
        return -1;
      },
      stopSearch: () => {
        if (search.provides) {
          search.provides.stopSearch();
        }
      },
      startSearch: () => {
        if (search.provides) {
          search.provides.startSearch();
        }
      },
      getSearchState: (): any => {
        if (search.provides) {
          return search.provides.getState();
        }
        return null;
      },
      setShowAllResults: (show: boolean) => {
        if (search.provides) {
          search.provides.setShowAllResults(show);
        }
      },
    },
    document: {
      isReady: () => isReady,
      isLoading: () => isLoading,
      hasPassword: () => {
        return Boolean(docState?.errorCode === PdfErrorCode.Password || (docState as any)?.isEncrypted);
      },
      getDocumentInfo: () => ({
        currentPage: scroll.state?.currentPage || 1,
        totalPages: verifiedTotalPagesRef.current > 0 ? verifiedTotalPagesRef.current : (scroll.state?.totalPages > 1 ? scroll.state.totalPages : 0),
        zoomLevel: zoom.state?.zoomLevel || 1.0,
        hasActiveSearch: Boolean(search.state),
      }),
    },
    scroll: {
      scrollToPage: (options: { pageNumber: number; pageCoordinates?: { x: number; y: number }; center?: boolean }) => {
        performScrollToPage(options.pageNumber);
      },
    },
    rotate: {
      rotateForward: () => {
        if (rotate.provides) {
          rotate.provides.rotateForward();
        }
      },
      rotateBackward: () => {
        if (rotate.provides) {
          rotate.provides.rotateBackward();
        }
      },
      setRotation: (rotation: Rotation) => {
        if (rotate.provides) {
          rotate.provides.setRotation(rotation);
        }
      },
      getRotation: () => {
        if (rotate.provides) {
          return rotate.provides.getRotation();
        }
        return Rotation.Degree0;
      },
    },
    annotation: {
      activateHighlighter: () => {
        if (!annotation.provides) return;
        annotation.provides.setActiveTool('highlight');
      },
      deactivateHighlighter: () => {
        if (!annotation.provides) return;
        annotation.provides.setActiveTool(null);
      },
      isHighlighterActive: () => {
        if (!annotation.provides) return false;
        return annotation.provides.getActiveTool()?.id === 'highlight';
      },
      activateStamp: async (imageDataUrl?: string) => {
        if (!annotation.provides) {
          console.warn("Cannot activate stamp: annotation API unavailable");
          return;
        }

        if (!imageDataUrl) {
          annotation.provides.setActiveTool('stamp');
          return;
        }

        try {
          console.debug('[PDFViewer] activateStamp invoked');
          const toolId = await ensureStampTool(imageDataUrl, currentUserInfoRef.current || undefined);
          if (!toolId || !annotation.provides) return;

          annotation.provides.setActiveTool(null);
          await waitForNextFrame();
          annotation.provides.setActiveTool(toolId);
          console.debug('[PDFViewer] custom stamp tool active request sent', { toolId });
          const activated = await waitForActiveTool(toolId);
          console.debug('[PDFViewer] custom stamp tool activation result', { toolId, activated });
          if (activated) {
            setAnnotationRenderVersion((version) => version + 1);
          }
        } catch (error) {
          console.error('Failed to activate custom stamp tool', error);
        }
      },
      deactivateStamp: () => {
        if (!annotation.provides) return;
        const activeTool = annotation.provides.getActiveTool();
        if (!activeTool) return;

        const customId = customStampToolIdRef.current;
        if (activeTool.id === 'stamp' || (customId && activeTool.id === customId)) {
          annotation.provides.setActiveTool(null);
        }
      },
      isStampActive: () => {
        if (!annotation.provides) return false;
        const activeTool = annotation.provides.getActiveTool();
        const customId = customStampToolIdRef.current;
        return activeTool?.id === 'stamp' || (customId !== null && activeTool?.id === customId);
      },
      addStampAnnotation: (imageDataUrl: string, pageIndex: number, x: number, y: number, width: number, height: number, userInfo?: { author?: string; customData?: any }) => {
        if (!annotation.provides) {
          console.warn('Annotation API not available');
          return false;
        }

        try {
          const api = annotation.provides as any;
          if (!api.createAnnotation) {
            console.warn('createAnnotation is not available on the annotation API');
            return false;
          }

          const annotationData: any = {
            type: PdfAnnotationSubtype.STAMP,
            rect: [x, y, x + width, y + height],
            imageSrc: imageDataUrl,
            imageSize: { width, height },
          };

          // Add user information if provided
          if (userInfo?.author) {
            annotationData.author = userInfo.author;
          }

          // Add any custom data
          if (userInfo?.customData) {
            annotationData.customData = userInfo.customData;
          }

          api.createAnnotation(pageIndex, annotationData);

          if (api.commit) {
            api.commit();
          }

          return true;
        } catch (error) {
          console.error('Failed to add stamp annotation', error);
          return false;
        }
      },
      activateSignature: () => {
        if (!annotation.provides) return;
        annotation.provides.setActiveTool('ink');
        console.log('Signature mode activated (using ink tool for drawing)');
      },
      deactivateSignature: () => {
        if (!annotation.provides) return;
        annotation.provides.setActiveTool(null);
      },
      activateTool: (toolId: string) => {
        if (!annotation.provides) return;
        annotation.provides.setActiveTool(toolId);
      },
      deactivateTool: () => {
        if (!annotation.provides) return;
        annotation.provides.setActiveTool(null);
      },
      getActiveTool: () => {
        if (!annotation.provides) return null;
        return annotation.provides.getActiveTool();
      },
      isSignatureActive: () => {
        if (!annotation.provides) return false;
        return annotation.provides.getActiveTool()?.id === 'ink';
      },
      addSignatureAnnotation: () => {
        console.warn('addSignatureAnnotation is not fully supported by embedpdf plugin API. Use activateSignature() instead to let users place signatures manually.');
        return false;
      },
      deleteSelectedAnnotation: () => {
        if (!annotation.provides) return false;
        const api = annotation.provides as any;
        const selection = api.getSelectedAnnotation();
        if (!selection) return false;
        api.deleteAnnotation(selection.object.pageIndex, selection.object.id);
        // Every other mutating call here (updateAnnotation, stamp placement,
        // print/download bytes) explicitly commits afterward — this one
        // didn't. @embedpdf/plugin-annotation's delete, like create/update,
        // only stages the removal (dispatches JS state, marks the entry
        // "deleted" internally) when the history plugin is active; nothing
        // writes it into the actual PDFium document until something calls
        // commit(). Left uncommitted, the annotation stays physically
        // present in the live document — invisible in the UI (JS state says
        // deleted) but still there for anything that reads the real
        // document afterward (e.g. a "with annotations" print/export).
        if (api.commit) {
          api.commit();
        }
        return true;
      },
      deleteAnnotationsById: async (items: Array<{ pageIndex: number; annotationId: string }>) => {
        if (!annotation.provides || items.length === 0) return false;
        const api = annotation.provides as any;
        if (api.deleteAnnotations) {
          // Batch capability: stages every delete (each dispatches + registers
          // with history synchronously) without an intermediate commit.
          api.deleteAnnotations(items.map((i) => ({ pageIndex: i.pageIndex, id: i.annotationId })));
        } else {
          // Fallback for older engines without the batch capability — accept
          // the same lock-racing risk deleteAnnotationById has.
          for (const { pageIndex, annotationId } of items) {
            api.deleteAnnotation(pageIndex, annotationId);
          }
        }
        if (api.commit) {
          // commit() returns the library's own Task (.wait(onSuccess, onError)
          // callbacks), not a real Promise — genuinely wait for it here so the
          // caller can trust the deletion has actually reached the document
          // by the time this resolves, rather than firing commit and hoping.
          const task = api.commit();
          if (task && typeof task.wait === 'function') {
            await new Promise<void>((resolve, reject) => {
              task.wait(() => resolve(), (err: any) => reject(err));
            });
          }
        }
        return true;
      },
      deleteAnnotationById: (pageIndex: number, annotationId: string) => {
        if (!annotation.provides) return false;
        const api = annotation.provides as any;
        api.deleteAnnotation(pageIndex, annotationId);
        // See the comment in deleteSelectedAnnotation above — commit() must
        // be called explicitly or the deletion never reaches the actual
        // PDFium document.
        if (api.commit) {
          api.commit();
        }
        return true;
      },
      getSelectedAnnotation: () => {
        if (!annotation.provides) return null;
        const selected = annotation.provides.getSelectedAnnotation();
        return selected?.object ?? null;
      },
      getSelectedAnnotationDetails: () => {
        if (!annotation.provides) return null;
        const selected = annotation.provides.getSelectedAnnotation();
        if (!selected || !selected.object) return null;

        // Return the complete annotation object with all properties
        // This matches the format: { type, rect, icon, subject, flags, pageIndex, id, created, author }
        return selected.object;
      },
      getAllAnnotations: () => {
        if (!annotation.provides) {
          console.warn('[PDFViewer] Annotation API not available');
          return [];
        }

        const api = annotation.provides as any;

        // Check if there's a direct getAllAnnotations method
        if (typeof api.getAllAnnotations === 'function') {
          console.log('[PDFViewer] Using annotation.provides.getAllAnnotations()');
          return api.getAllAnnotations();
        }

        // Check for getAnnotations method
        if (typeof api.getAnnotations === 'function') {
          console.log('[PDFViewer] Using annotation.provides.getAnnotations()');
          return api.getAnnotations();
        }

        console.warn('[PDFViewer] No direct method to get all annotations. Use onAnnotationEvent to capture annotations as they are created/updated.');
        return [];
      },
      onAnnotationEvent: (callback: (event: any) => void) => {
        if (!annotation.provides) return null;
        return annotation.provides.onAnnotationEvent(callback);
      },
      updateAnnotation: (pageIndex: number, annotationId: string, updates: Record<string, any>) => {
        if (!annotation.provides) {
          console.warn('Annotation API not available');
          return false;
        }

        try {
          const api = annotation.provides as any;

          // See ensurePrintableFlags' doc comment above: whenever this patch
          // touches flags at all, make sure it doesn't silently clear the
          // PDF's Print bit along with it.
          const finalUpdates =
            updates && 'flags' in updates
              ? { ...updates, flags: ensurePrintableFlags(updates.flags) }
              : updates;

          if (api.updateAnnotation) {
            api.updateAnnotation(pageIndex, annotationId, finalUpdates);

            if (api.commit) {
              api.commit();
            }

            return true;
          }

          console.warn('updateAnnotation method not available on the annotation API');
          return false;
        } catch (error) {
          console.error('Failed to update annotation', error);
          return false;
        }
      },
      selectAnnotation: (pageIndex: number, annotationId: string | null) => {
        if (!annotation.provides) {
          console.warn('Annotation API not available');
          return false;
        }

        try {
          const api = annotation.provides as any;

          if (api.selectAnnotation) {
            api.selectAnnotation(pageIndex, annotationId);
            return true;
          }

          console.warn('selectAnnotation method not available on the annotation API');
          return false;
        } catch (error) {
          console.error('Failed to select annotation', error);
          return false;
        }
      },
      importAnnotations: async (annotations: Array<{ pageIndex: number; annotation: Record<string, any>; ctx?: { imageData?: any } }>) => {
        console.log(`[importAnnotations] Importing ${annotations.length} annotations`);
        if (!annotation.provides) {
          console.warn('[importAnnotations] Annotation API not available');
          return { success: 0, failed: annotations.length };
        }

        const api = annotation.provides as any;

        for (const item of annotations) {
          if (item.annotation?.id) addedAnnotationIdsRef.current.add(String(item.annotation.id));
        }

        // Pre-process annotations to ensure stamps have robust context data.
        // For stamps (type 13), if ctx.imageData is missing, inject the imageSrc string.
        // This addresses issues in the client where ImageData objects might not be available.
        // IMPORTANT: Do NOT overwrite existing ctx.imageData (the demo passes proper ImageData objects)
        const processedAnnotations = annotations.map(item => {
          if (item.annotation.type === 13) { // Stamp
            const imageSrc = item.annotation.imageSrc || item.annotation.custom?.imageSrc;

            // Only enhance if:
            // 1. We have an imageSrc string
            // 2. ctx.imageData is NOT already a proper ImageData object
            const hasProperImageData = item.ctx?.imageData &&
              typeof item.ctx.imageData === 'object' &&
              item.ctx.imageData.data &&
              item.ctx.imageData.width;

            if (imageSrc && typeof imageSrc === 'string' && !hasProperImageData) {
              console.log(`[importAnnotations] Enhancing context for stamp ${item.annotation.id?.substring(0, 8)} (no ImageData provided)`);
              return {
                ...item,
                ctx: {
                  ...(item.ctx || {}),
                  // Add string fallbacks for compatibility
                  imageData: imageSrc,
                  image: imageSrc,
                  data: imageSrc
                }
              };
            }
          }
          return item;
        });

        let successCount = 0;
        let failedCount = 0;

        // Try native importAnnotations first
        if (api.importAnnotations) {
          try {
            console.log('[importAnnotations] Using native importAnnotations method with processed data');
            const result = await api.importAnnotations(processedAnnotations);
            console.log('[importAnnotations] Native import result:', result);

            // Force re-render for stamps
            setAnnotationRenderVersion((v) => v + 1);

            console.log('[importAnnotations] Native import successful');
            return { success: annotations.length, failed: 0 };
          } catch (error) {
            console.error('[importAnnotations] Native importAnnotations failed, falling back:', error);
          }
        }

        // Fallback: use createAnnotation for each annotation
        console.log('[importAnnotations] Using createAnnotation fallback method');
        for (const item of processedAnnotations) {
          try {
            if (api.createAnnotation) {
              api.createAnnotation(item.pageIndex, item.annotation, item.ctx);
              successCount++;
            } else {
              console.warn(`[importAnnotations] createAnnotation not available for page ${item.pageIndex}`);
              failedCount++;
            }
          } catch (error) {
            console.error(`[importAnnotations] Failed to import annotation on page ${item.pageIndex}`, error);
            failedCount++;
          }
        }

        if (successCount > 0) {
          try {
            console.log(`[importAnnotations] Imported ${successCount} annotations`);

            // Force re-render to ensure visibility
            setAnnotationRenderVersion((v) => v + 1);
          } catch (error) {
            console.error('[importAnnotations] Failed after importing annotations', error);
          }
        }

        return { success: successCount, failed: failedCount };
      },
      onStateChange: (callback: (state: any) => void) => {
        if (!annotation.provides) {
          console.warn('Annotation API not available');
          return null;
        }

        const api = annotation.provides as any;

        if (api.onStateChange) {
          return api.onStateChange(callback);
        }

        console.warn('onStateChange method not available. Consider using onAnnotationEvent instead.');
        return null;
      },
      getAllAnnotationsWithMetadata: (annotationsArray?: any[]) => {
        // If annotations not provided, try to get them
        const annotations = annotationsArray || [];

        return annotations.map((ann: any) => {
          const metadata = annotationsMetadata.get(ann.id) || {};
          return {
            ...ann,
            // Merge with custom metadata if available
            createdBy: metadata.createdBy || ann.author || userDetails?.name || 'Unknown',
            createdAt: metadata.createdAt || ann.created || ann.creationDate || null,
            updatedAt: metadata.updatedAt || ann.modificationDate || null,
            userEmail: metadata.userEmail || userDetails?.email || null,
            userId: metadata.userId || userDetails?.id || null,
          };
        });
      },
      exportAnnotationsAsJSON: () => {
        const annotations: any[] = [];
        annotationsMetadata.forEach((metadata, annotationId) => {
          annotations.push({
            id: annotationId,
            ...metadata,
          });
        });

        const exportData = {
          documentInfo: {
            totalPages: verifiedTotalPages > 0 ? verifiedTotalPages : (scroll.state?.totalPages > 1 ? scroll.state.totalPages : 0),
            exportedAt: new Date().toISOString(),
          },
          userDetails: userDetails || null,
          annotations,
          summary: {
            totalAnnotations: annotations.length,
            byType: annotations.reduce((acc: any, ann) => {
              acc[ann.type] = (acc[ann.type] || 0) + 1;
              return acc;
            }, {}),
          },
        };

        return JSON.stringify(exportData, null, 2);
      },
      enableClickToPlace: (callback: (clickData: { pageIndex: number; x: number; y: number; pageWidth?: number; pageHeight?: number }) => void) => {
        console.log('Click-to-place mode enabled');
        clickToPlaceCallbackRef.current = callback;
      },
      placeStampAtPosition: async (imageDataUrl: string, pageIndex: number, x: number, y: number) => {
        if (!annotation.provides) {
          console.error('Annotation API not available');
          return;
        }

        try {
          const { width, height } = await loadImageDimensions(imageDataUrl);
          const maxWidth = 200;
          const maxHeight = 200;

          let stampWidth = width;
          let stampHeight = height;

          if (stampWidth > maxWidth) {
            const scale = maxWidth / stampWidth;
            stampWidth = maxWidth;
            stampHeight = Math.round(stampHeight * scale);
          }

          if (stampHeight > maxHeight) {
            const scale = maxHeight / stampHeight;
            stampHeight = maxHeight;
            stampWidth = Math.round(stampWidth * scale);
          }

          const api = annotation.provides as any;
          if (!api.createAnnotation) {
            console.warn('createAnnotation is not available on the annotation API');
            return;
          }

          await api.createAnnotation(pageIndex, {
            type: PdfAnnotationSubtype.STAMP,
            rect: [x, y, x + stampWidth, y + stampHeight],
            imageSrc: imageDataUrl,
            imageSize: { width: stampWidth, height: stampHeight },
          });

          if (api.commit) {
            await api.commit();
          }
        } catch (error) {
          console.error('Error placing stamp', error);
        }

        clickToPlaceCallbackRef.current = null;
      },

      // v2.14.1 lock predicates — engine-enforced
      isAnnotationInteractive: (ann) => {
        const cap = annotation.provides as any;
        return cap?.isAnnotationInteractive?.(ann) ?? true;
      },
      isAnnotationStructurallyLocked: (ann) => {
        const cap = annotation.provides as any;
        return cap?.isAnnotationStructurallyLocked?.(ann) ?? false;
      },
      isAnnotationContentLocked: (ann) => {
        const cap = annotation.provides as any;
        return cap?.isAnnotationContentLocked?.(ann) ?? false;
      },

      // v2.14.1 document-level lock mode.
      setLocked: (mode) => {
        requestedLockRef.current = mode;
        applyLock();
      },
      getLocked: () => {
        return requestedLockRef.current ?? ({ type: 0 /* LockModeType.None */ } as LockMode);
      },
    },
    download: {
      downloadWithAnnotations: async (filename = 'document-with-annotations.pdf') => {
        if (!engine) {
          console.error('Engine not available');
          return;
        }
        const doc = docState?.document;
        if (!doc) {
          console.error('Document not available for saveAsCopy');
          return;
        }
        try {
          const task = engine.saveAsCopy(doc);
          const pdfBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
            task.wait(
              (buffer: ArrayBuffer) => resolve(buffer),
              (error: any) => reject(error)
            );
          });
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Error downloading PDF with annotations:', error);
        }
      },
      downloadWithoutAnnotations: async (filename = 'document-original.pdf') => {
        if (!pdfBuffer) {
          console.error('Original PDF buffer not available');
          return;
        }
        try {
          const blob = new Blob([pdfBuffer as BlobPart], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Error downloading original PDF:', error);
        }
      },
    },
    print: {
      printWithAnnotations: async () => {
        if (!print.provides) {
          console.error('Print plugin not available');
          return;
        }
        print.provides.print({ includeAnnotations: true });
      },
      printWithoutAnnotations: async () => {
        if (!print.provides) {
          console.error('Print plugin not available');
          return;
        }
        print.provides.print({ includeAnnotations: false });
      },
    },
    forms: {
      getFormState: () => formStateRef.current,
      getFormFields: () => formCapability?.forDocument(documentId).getFormFields() ?? [],
      getFormValues: () => formCapability?.forDocument(documentId).getFormValues() ?? {},
      setFormValues: async (values: Record<string, string>) => {
        if (!formCapability) return false;
        return taskToPromise<boolean>(formCapability.forDocument(documentId).setFormValues(values));
      },
      getFilledPdf: async () => {
        const doc = docState?.document;
        if (!engine || !doc || !pdfBuffer) {
          console.error('[PDFViewer] getFilledPdf: document not loaded');
          return null;
        }
        // Let a field that is just losing focus start its final write, then
        // wait for all writes to reach the document.
        await waitForNextFrame();
        await waitForFormWrites();
        return buildFilledPdf(
          engine,
          doc,
          addedAnnotationIdsRef.current,
          new Set(fieldLabelsRef.current.values()),
          deletedFieldWidgetIdsRef.current.size > 0,
          pdfBuffer,
          acceptedPasswordRef.current,
        );
      },
      markFormSaved: () => {
        if (!formCapability) return;
        const scope = formCapability.forDocument(documentId);
        formStructureChangedRef.current = false;
        formBaselineRef.current = {
          fieldCount: scope.getFormFields().length,
          values: scope.getFormValues(),
        };
        publishFormState();
      },
      activateFieldTool: (type: FormFieldToolType) => {
        const cap = annotation.provides as any;
        if (!cap) return;
        if (!enableFormDesignRef.current) {
          console.warn('[PDFViewer] activateFieldTool: enable form design mode (enableFormDesign) first');
          return;
        }
        cap.setActiveTool(FORM_FIELD_TOOL_IDS[type]);
      },
      deactivateFieldTool: () => {
        const cap = annotation.provides as any;
        if (isFormFieldToolId(cap?.getActiveTool?.()?.id)) {
          cap.setActiveTool(null);
        }
      },
      getActiveFieldTool: () => {
        const id = (annotation.provides as any)?.getActiveTool?.()?.id;
        const entry = Object.entries(FORM_FIELD_TOOL_IDS).find(([, toolId]) => toolId === id);
        return entry ? (entry[0] as FormFieldToolType) : null;
      },
      getSelectedField: () => selectedFieldRef.current,
      updateField: (annotationId: string, changes: FormFieldChanges) => {
        const cap = annotation.provides as any;
        const widget = findWidget(annotationId);
        if (!cap || !widget) return false;
        const { label, ...fieldChanges } = changes;
        if (Object.keys(fieldChanges).length > 0) {
          // Same write EmbedPDF's own form panel uses: the engine rewrites the
          // field's flags, value, MaxLen and options from the patched field.
          const patch = { field: applyFieldChanges(widget.field, fieldChanges) };
          if (typeof cap.updateAnnotations === 'function') {
            cap.updateAnnotations([{ pageIndex: widget.pageIndex, id: annotationId, patch }]);
          } else {
            cap.updateAnnotation(widget.pageIndex, annotationId, patch);
          }
        }
        if (label !== undefined) setFieldLabel(widget, label);
        formStructureChangedRef.current = true;
        publishFormState();
        return true;
      },
      renameField: async (annotationId: string, name: string) => {
        if (!formCapability) return { outcome: 'no-op' } as RenameFormFieldResult;
        const result: any = await taskToPromise(formCapability.forDocument(documentId).renameField(annotationId, name.trim()));
        if (result?.outcome === 'renamed') {
          formStructureChangedRef.current = true;
          publishFormState();
        }
        return result as RenameFormFieldResult;
      },
      shareField: async (annotationId: string, targetAnnotationId: string) => {
        if (!formCapability) return false;
        const ok = await taskToPromise<boolean>(formCapability.forDocument(documentId).shareField(annotationId, targetAnnotationId));
        if (ok) {
          formStructureChangedRef.current = true;
          publishFormState();
        }
        return ok;
      },
      deleteField: (annotationId: string) => {
        const cap = annotation.provides as any;
        const widget = findWidget(annotationId);
        if (!cap || !widget) return false;
        cap.deleteAnnotation(widget.pageIndex, annotationId);
        cap.commit?.();
        return true;
      },
    },
  }), [zoom, search, scroll, rotate, annotation, print, engine, pdfBuffer, isReady, isLoading, hasPassword, ensureStampTool, waitForActiveTool, verifiedTotalPages, docState, formCapability, documentId, publishFormState, waitForFormWrites, waitForNextFrame, findWidget, setFieldLabel]);

  const currentZoom = zoom.state?.currentZoomLevel || 1;

  const renderPage = useCallback(({
    pageIndex,
    scale,
    width,
    height,
    document,
    rotation,
  }: any) => {
    // Rely on internal layout handling from Rotate/RenderLayer
    // Removing manual width/height swapping to match reference implementation

    const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // Only handle clicks if we're in click-to-place mode
      if (clickToPlaceCallbackRef.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        console.log(`Page clicked at: page=${pageIndex}, x=${x}, y=${y}`);

        clickToPlaceCallbackRef.current({
          pageIndex,
          x,
          y,
          pageWidth: width,
          pageHeight: height,
          target: e.currentTarget as HTMLElement,
        });

        // Clear the callback after use
        clickToPlaceCallbackRef.current = null;
      }
    };

    const effectiveScale = (typeof scale === 'number' && scale > 0) ? scale : currentZoom;

    return (
      <div
        style={{
          position: "relative",
          backgroundColor: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          borderRadius: 4,
          cursor: clickToPlaceCallbackRef.current ? 'crosshair' : 'default',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        draggable={false}
        onClick={handlePageClick}
      >
        <Rotate
          key={`${document?.id ?? 'doc'}-${pageIndex}-${rotation}`}
          documentId={documentId}
          pageIndex={pageIndex}
          rotation={rotation}
        >
          <PagePointerProvider
            documentId={documentId}
            pageIndex={pageIndex}
          >
            <RenderLayer
              documentId={documentId}
              pageIndex={pageIndex}
              scale={effectiveScale}
              style={{ pointerEvents: "none" }}
            />
            <SearchLayer
              documentId={documentId}
              pageIndex={pageIndex}
              scale={effectiveScale}
              style={{ pointerEvents: "none" }}
            />
            <SelectionLayer
              documentId={documentId}
              pageIndex={pageIndex}
              scale={effectiveScale}
            />
            <AnnotationLayer
              key={`annotation-layer-${pageIndex}-${annotationRenderVersion}`}
              documentId={documentId}
              pageIndex={pageIndex}
              scale={effectiveScale}
            />
          </PagePointerProvider>
        </Rotate>
        <AnnotationFloatingToolbar
          annotationPlugin={annotation as any}
          documentId={documentId}
          pageIndex={pageIndex}
          scale={effectiveScale}
          pageSize={{ width: width / effectiveScale, height: height / effectiveScale }}
        />
      </div>
    );
  }, [annotationRenderVersion, annotationSelectionMenu, documentId, currentZoom]);

  return (
    <FormEditingContext.Provider value={enableFormFilling}>
    <FormLabelsContext.Provider value={formLabelsContext}>
    <FormRendererRegistration />
    <DocumentContent documentId={documentId}>
      {({ isLoaded, documentState }) => {
        console.log('[PDFContent] DocumentContent render:', {
          documentId,
          isLoaded,
          hasEngine: !!engine,
          hasPdfBuffer: !!pdfBuffer,
          docState: documentState?.errorCode,
          isEncrypted: (documentState as any)?.isEncrypted
        });

        if (isLoaded) {
          console.log('[PDFContent] Rendering Viewport and Scroller for document:', documentId);
        }

        return (
          <>
            <PasswordLogic
              documentState={documentState}
              documentId={documentId}
              onPasswordAccepted={handlePasswordAccepted}
              {...(onPasswordRequest ? { onPasswordRequest } : {})}
            />
            {isLoaded ? (
              <GlobalPointerProvider documentId={documentId}>
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", userSelect: 'none', WebkitUserSelect: 'none' }}>
                  <Viewport
                    documentId={documentId}
                    style={{
                      width: "100%",
                      height: "100%",
                      flexGrow: 1,
                      backgroundColor: "#eeeeee",
                      overflow: "auto",
                      position: "relative",
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}
                  >
                    <Scroller documentId={documentId} renderPage={renderPage} />
                  </Viewport>
                </div>
              </GlobalPointerProvider>
            ) : (
              hideInternalLoading ? null : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: '#fff' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div>
                      {documentState?.errorCode === PdfErrorCode.Password
                        ? "Waiting for password..."
                        : "Loading PDF content..."}
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
                      Document ID: {documentId.substring(0, 20)}...
                    </div>
                  </div>
                </div>
              )
            )}
          </>
        );
      }}
    </DocumentContent>
    </FormLabelsContext.Provider>
    </FormEditingContext.Provider>
  );
});

const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(function PDFViewer(
  { pdfBuffer, onPasswordRequest, annotationSelectionMenu, userDetails, permissions, hideInternalLoading, twoPageMode, scrollStrategy, onPageChange, enableFormFilling = false, enableFormDesign = false, onFormStateChange, onFormFieldSelect },
  ref
): ReactElement | null {
  const {
    engine,
    isLoading: engineLoading,
    error: engineError,
  } = usePdfiumEngine();

  const [password, setPassword] = useState("");
  const [isPasswordChecked, setIsPasswordChecked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Create stable documentId for multi-document support in v2.x
  // Use a hash of the buffer content to create a stable ID that survives HMR
  const [documentId, setDocumentId] = useState<string>('');
  const lastBufferHashRef = useRef<string>('');

  useEffect(() => {
    if (!pdfBuffer) {
      setDocumentId('');
      lastBufferHashRef.current = '';
      return;
    }

    // Create a simple hash from the buffer to detect actual content changes
    // Use first/last bytes and length as a lightweight fingerprint
    const first4 = Array.from(pdfBuffer.slice(0, 4)).join(',');
    const last4 = Array.from(pdfBuffer.slice(-4)).join(',');
    const bufferHash = `${pdfBuffer.byteLength}-${first4}-${last4}`;

    // Only create a new document ID if the buffer content actually changed
    if (bufferHash !== lastBufferHashRef.current) {
      const newId = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      console.log('[PDFViewer] New PDF content detected (hash changed), creating new document ID:', newId, 'hash:', bufferHash);
      lastBufferHashRef.current = bufferHash;
      setDocumentId(newId);
    } else {
      console.log('[PDFViewer] Same PDF content (hash unchanged), keeping existing ID:', documentId);
    }
  }, [pdfBuffer]);

  // @embedpdf/engines 2.15 orders same-priority queued tasks by a timestamp
  // parsed from the task id — but in browsers the ids are random UUIDs, so the
  // "timestamp" is 0 except for the few ids whose first segment happens to
  // parse as a number, which get pushed behind everything else. Under load
  // that reorders writes: typing fast into a form field could leave an older
  // value in the document. With every timestamp 0 the (stable) sort keeps
  // tasks in the order they were queued, which is what was intended.
  useEffect(() => {
    const queue = (engine as any)?.workerQueue;
    if (queue && typeof queue.extractTime === "function") {
      queue.extractTime = () => 0;
    }
  }, [engine]);

  // Log engine errors
  useEffect(() => {
    if (engineError) {
      console.error('[PDFViewer] Engine error:', engineError);
      console.error('[PDFViewer] Engine error details:', JSON.stringify(engineError, null, 2));
    }
  }, [engineError]);

  const plugins = useMemo(() => {
    if (!pdfBuffer || !isReady || !documentId) {
      console.log('[PDFViewer] Plugins not ready:', { hasPdfBuffer: !!pdfBuffer, isReady, hasDocumentId: !!documentId });
      return [];
    }

    console.log('[PDFViewer] Creating plugins with pdfBuffer:', {
      documentId,
      type: pdfBuffer.constructor.name,
      byteLength: pdfBuffer.byteLength,
      hasBuffer: !!pdfBuffer.buffer
    });

    try {
      // Convert Uint8Array to ArrayBuffer properly
      const bufferToUse = pdfBuffer instanceof Uint8Array
        ? pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength)
        : pdfBuffer;

      console.log('[PDFViewer] Buffer details:', {
        isUint8Array: pdfBuffer instanceof Uint8Array,
        originalByteLength: pdfBuffer.byteLength,
        convertedByteLength: (bufferToUse as ArrayBuffer).byteLength,
        bufferConstructor: bufferToUse?.constructor?.name
      });

      const documentConfig = {
        documentId: documentId,
        buffer: bufferToUse as ArrayBuffer,
        name: 'document.pdf',
        ...(password ? { password } : {}),
      };

      console.log('[PDFViewer] Document config:', {
        documentId: documentConfig.documentId,
        bufferSize: documentConfig.buffer.byteLength,
        name: documentConfig.name,
        hasPassword: !!password
      });

      return [
        createPluginRegistration(DocumentManagerPluginPackage, {
          initialDocuments: [{
            documentId: documentConfig.documentId,
            buffer: documentConfig.buffer,
            name: documentConfig.name,
            autoActivate: true,
            ...(password ? { password: documentConfig.password } : {}),
          }],
        }),
        createPluginRegistration(RenderPluginPackage),
        createPluginRegistration(ViewportPluginPackage, {
          viewportGap: 10,
        }),
        createPluginRegistration(ZoomPluginPackage, {
          defaultZoomLevel: ZoomMode.FitPage,  // Use FitPage mode to ensure proper initialization
          minZoom: 0.2,
          maxZoom: 5.0,
        }),
        createPluginRegistration(SpreadPluginPackage),
        createPluginRegistration(ScrollPluginPackage),
        createPluginRegistration(InteractionManagerPluginPackage),
        createPluginRegistration(RotatePluginPackage),
        createPluginRegistration(SelectionPluginPackage),
        createPluginRegistration(SearchPluginPackage),
        createPluginRegistration(HistoryPluginPackage),
        createPluginRegistration(AnnotationPluginPackage, {
          annotationAuthor: "User",
          // Stamps loaded from a saved PDF match the library's built-in "stamp"
          // tool, not our lazily-registered "customStamp" tool, so its
          // isRotatable: false never applied to them. Patch the built-in tool too.
          // (The form field tools are registered by FormPluginPackage itself.)
          tools: [{ id: "stamp", interaction: { exclusive: false, isRotatable: false } }],
          locked: FORM_FILL_LOCK,
        }),
        createPluginRegistration(FormPluginPackage),
        createPluginRegistration(PrintPluginPackage),
      ];
    } catch (error) {
      console.error('[PDFViewer] Error creating plugins:', error);
      return [];
    }
  }, [pdfBuffer, password, isReady, engine, documentId]);

  useEffect(() => {
    const hasValidBuffer = Boolean(
      pdfBuffer && (
        pdfBuffer instanceof Uint8Array ||
        (pdfBuffer as any)?.byteLength !== undefined
      )
    );

    const ready =
      engineLoading === false &&
      engineError === null &&
      engineLoading === false &&
      engineError === null &&
      hasValidBuffer;

    console.log('[PDFViewer] Ready check:', {
      engineLoading,
      engineError: !!engineError,
      isPasswordChecked,
      pdfBufferType: pdfBuffer?.constructor.name,
      hasValidBuffer,
      ready
    });

    setIsReady(ready);
    setIsReady(ready);
  }, [engineLoading, engineError, pdfBuffer]);

  // Removed manual isPasswordProtected check in favor of handling it via DocumentManagerPlugin
  // useEffect logic for onPasswordRequest moved to PDFContent

  if (!engine) {
    console.log('[PDFViewer] Waiting for engine...');
    return null;
  }

  if (!isReady) {
    console.log('[PDFViewer] Not ready yet:', {
      engineLoading,
      engineError: !!engineError,
      isPasswordChecked,
      hasPdfBuffer: !!pdfBuffer,
    });
    return null;
  }

  return (
    <EmbedPDF
      engine={engine}
      plugins={plugins}
      {...(permissions ? { config: { permissions } } : {})}
    >
      {({ activeDocumentId }) => {
        console.log('[PDFViewer] EmbedPDF render:', {
          hasActiveDocumentId: !!activeDocumentId,
          activeDocumentId,
          expectedDocumentId: documentId,
          match: activeDocumentId === documentId
        });

        return activeDocumentId ? (
          <>
            <PDFContent
              ref={ref}
              isReady={isReady}
              isLoading={engineLoading}
              hasPassword={Boolean(password) /* handled internally */}
              pdfBuffer={pdfBuffer || null}
              engine={engine}
              documentId={activeDocumentId}
              {...(userDetails ? { userDetails } : {})}
              {...(annotationSelectionMenu ? { annotationSelectionMenu } : {})}
              {...(onPasswordRequest ? { onPasswordRequest } : {})}
              hideInternalLoading={!!hideInternalLoading}
              twoPageMode={twoPageMode}
              scrollStrategy={scrollStrategy}
              onPageChange={onPageChange}
              enableFormFilling={enableFormFilling}
              enableFormDesign={enableFormDesign}
              onFormFieldSelect={onFormFieldSelect}
              onFormStateChange={onFormStateChange}
            />
          </>
        ) : hideInternalLoading ? null : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: '#f5f5f5' }}>
            <div style={{ textAlign: 'center' }}>
              <div>Loading PDF...</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
                Initializing document ({documentId ? 'ID set' : 'waiting for ID'})
              </div>
            </div>
          </div>
        );
      }}
    </EmbedPDF >
  );
});

export default PDFViewer;
