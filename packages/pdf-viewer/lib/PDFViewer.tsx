import { EmbedPDF } from "@embedpdf/core/react";
// import { FilePicker } from "@embedpdf/plugin-loader/react";
import {
  Viewport,
  ViewportPluginPackage,
} from "@embedpdf/plugin-viewport/react";
import {
  Scroller,
  ScrollPluginPackage,
  ScrollStrategy,
} from "@embedpdf/plugin-scroll/react";
import {
  RenderLayer,
  RenderPluginPackage,
} from "@embedpdf/plugin-render/react";
import { SelectionLayer } from "@embedpdf/plugin-selection/react";
import { SearchLayer } from "@embedpdf/plugin-search/react";
import {
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from "@embedpdf/plugin-interaction-manager/react";
import { useZoom, ZoomMode, ZoomPluginPackage } from "@embedpdf/plugin-zoom/react";
import { useSearch } from "@embedpdf/plugin-search/react";
import { useRotate, Rotate, RotatePluginPackage } from "@embedpdf/plugin-rotate/react";
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
export { ZoomMode, Rotation };
export type { SearchState } from "@embedpdf/plugin-search";
export type { SearchResult, SearchAllPagesResult, MatchFlag } from "@embedpdf/models";

// Import types for internal use
import type { SearchAllPagesResult } from "@embedpdf/models";
import type { SearchState } from "@embedpdf/plugin-search";

import {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
  type ReactElement,
  useState,
} from "react";
import isPasswordProtected from "./utils/isPasswordProtected";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import { createPluginRegistration } from "@embedpdf/core";
import { LoaderPluginPackage } from "@embedpdf/plugin-loader";
import { SelectionPluginPackage } from "@embedpdf/plugin-selection";
import { SearchPluginPackage } from "@embedpdf/plugin-search";

interface PDFViewerProps {
  pdfBuffer?: ArrayBuffer | null | undefined;
  onPasswordRequest?: (fileName?: string) => Promise<string | null>;
}

export interface PDFViewerRef {
  zoom: {
    zoomIn: () => void;
    zoomOut: () => void;
    setZoom: (level: number) => void;
    resetZoom: () => void;
    getZoom: () => number | ZoomMode;
  };
  navigation: {
    goToPage: (page: number) => void;
    getCurrentPage: () => number;
    getTotalPages: () => number;
  };
  selection: {
    clearSelection: () => void;
    getSelectedText: () => string;
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
    // Tool activation
    activateHighlighter: () => void;
    deactivateHighlighter: () => void;
    isHighlighterActive: () => boolean;
    activateStamp: (imageDataUrl?: string) => void;
    deactivateStamp: () => void;
    isStampActive: () => boolean;
    activateSignature: () => void;
    deactivateSignature: () => void;
    isSignatureActive: () => boolean;

    // CRUD
    deleteSelectedAnnotation: () => boolean;
    getSelectedAnnotation: () => PdfAnnotationObject | null;
    getAllAnnotations: () => PdfAnnotationObject[];
    getAllAnnotationsWithMetadata: () => PdfAnnotationObject[];
    exportAnnotationsAsJSON: () => string;
    importAnnotations: (
      items: Array<{ pageIndex: number; annotation: Record<string, any> }>,
    ) => Promise<{ success: number; failed: number }>;
    selectAnnotation: (pageIndex: number, annotationId: string | null) => boolean;
    updateAnnotation: (
      pageIndex: number,
      annotationId: string,
      updates: Record<string, any>,
    ) => boolean;
    addStampAnnotation: (
      imageDataUrl: string,
      pageIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
      userInfo?: { author?: string; customData?: any },
    ) => boolean;
    addSignatureAnnotation: (
      signatureDataUrl: string,
      pageIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => boolean;
    placeStampAtPosition: (
      imageDataUrl: string,
      pageIndex: number,
      x: number,
      y: number,
    ) => void;
    enableClickToPlace: (
      callback: (clickData: {
        pageIndex: number;
        x: number;
        y: number;
        pageWidth?: number;
        pageHeight?: number;
      }) => void,
    ) => void;

    // Events
    onAnnotationEvent: (callback: (event: any) => void) => (() => void) | null;
    onStateChange: (callback: (state: any) => void) => (() => void) | null;

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
}

// Internal component that has access to plugin hooks
const PDFContent = forwardRef<PDFViewerRef>((_, ref) => {
  const zoom = useZoom();
  const search = useSearch();
  const rotate = useRotate();
  // TODO(plugin-migration): replace this `null` with `useAnnotationCapability().provides`
  // once @embedpdf/plugin-annotation@2.14.1 is registered in the plugins list below.
  // The `provides` shape exactly matches the methods used inside the annotation block.
  const annotationCap = null as null | any;
  // TODO: Add other plugin hooks when available
  // const scroll = useScroll();
  // const selection = useSelection();

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
      getZoom: () => zoom.state?.zoomLevel || 1.0,
    },
    navigation: {
      goToPage: (_page: number) => {
        // TODO: Implement when scroll plugin hook is available
        console.warn('goToPage not yet implemented');
      },
      getCurrentPage: () => {
        // TODO: Implement when scroll plugin hook is available
        console.warn('getCurrentPage not yet implemented');
        return 1;
      },
      getTotalPages: () => {
        // TODO: Implement when scroll plugin hook is available
        console.warn('getTotalPages not yet implemented');
        return 1;
      },
    },
    selection: {
      clearSelection: () => {
        // TODO: Implement when selection plugin hook is available
        console.warn('clearSelection not yet implemented');
      },
      getSelectedText: () => {
        // TODO: Implement when selection plugin hook is available
        console.warn('getSelectedText not yet implemented');
        return '';
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
      getSearchState: () => {
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
    // v2.14.1 annotation surface.
    // Each method below is a thin pass-through to AnnotationCapability.provides.
    // Until plugin-annotation is registered, methods no-op safely (return false /
    // null / [] / {success:0,failed:0}) so consumers can feature-detect.
    annotation: {
      activateHighlighter: () => annotationCap?.activateHighlighter?.(),
      deactivateHighlighter: () => annotationCap?.deactivateHighlighter?.(),
      isHighlighterActive: () => !!annotationCap?.isHighlighterActive?.(),
      activateStamp: (imageDataUrl?: string) =>
        annotationCap?.activateStamp?.(imageDataUrl),
      deactivateStamp: () => annotationCap?.deactivateStamp?.(),
      isStampActive: () => !!annotationCap?.isStampActive?.(),
      activateSignature: () => annotationCap?.activateSignature?.(),
      deactivateSignature: () => annotationCap?.deactivateSignature?.(),
      isSignatureActive: () => !!annotationCap?.isSignatureActive?.(),

      deleteSelectedAnnotation: () =>
        !!annotationCap?.deleteSelectedAnnotation?.(),
      getSelectedAnnotation: () =>
        annotationCap?.getSelectedAnnotation?.() ?? null,
      getAllAnnotations: () => annotationCap?.getAllAnnotations?.() ?? [],
      getAllAnnotationsWithMetadata: () =>
        annotationCap?.getAllAnnotationsWithMetadata?.() ?? [],
      exportAnnotationsAsJSON: () =>
        annotationCap?.exportAnnotationsAsJSON?.() ?? '[]',
      importAnnotations: async (items) =>
        (await annotationCap?.importAnnotations?.(items)) ?? {
          success: 0,
          failed: items.length,
        },
      selectAnnotation: (pageIndex, annotationId) =>
        !!annotationCap?.selectAnnotation?.(pageIndex, annotationId),
      updateAnnotation: (pageIndex, annotationId, updates) =>
        !!annotationCap?.updateAnnotation?.(pageIndex, annotationId, updates),
      addStampAnnotation: (imageDataUrl, pageIndex, x, y, width, height, userInfo) =>
        !!annotationCap?.addStampAnnotation?.(
          imageDataUrl,
          pageIndex,
          x,
          y,
          width,
          height,
          userInfo,
        ),
      addSignatureAnnotation: (signatureDataUrl, pageIndex, x, y, width, height) =>
        !!annotationCap?.addSignatureAnnotation?.(
          signatureDataUrl,
          pageIndex,
          x,
          y,
          width,
          height,
        ),
      placeStampAtPosition: (imageDataUrl, pageIndex, x, y) =>
        annotationCap?.placeStampAtPosition?.(imageDataUrl, pageIndex, x, y),
      enableClickToPlace: (callback) =>
        annotationCap?.enableClickToPlace?.(callback),

      onAnnotationEvent: (callback) =>
        annotationCap?.onAnnotationEvent?.(callback) ?? null,
      onStateChange: (callback) =>
        annotationCap?.onStateChange?.(callback) ?? null,

      // v2.14.1 lock predicates — engine-enforced
      isAnnotationInteractive: (annotation) =>
        annotationCap?.isAnnotationInteractive?.(annotation) ?? true,
      isAnnotationStructurallyLocked: (annotation) =>
        annotationCap?.isAnnotationStructurallyLocked?.(annotation) ?? false,
      isAnnotationContentLocked: (annotation) =>
        annotationCap?.isAnnotationContentLocked?.(annotation) ?? false,

      // v2.14.1 document-level lock mode
      setLocked: (mode) => annotationCap?.setLocked?.(mode),
      getLocked: () =>
        annotationCap?.getLocked?.() ?? ({ type: 0 /* LockModeType.None */ } as LockMode),
    },
  }), [zoom, search, rotate, annotationCap]);

  const renderPage = useCallback(({
    pageIndex,
    scale,
    width,
    height,
    document,
    rotation,
  }: any) => {
    // Swap width and height for 90° and 270° rotations
    const isRotated90or270 = rotation === 1 || rotation === 3;
    const containerWidth = isRotated90or270 ? height : width;
    const containerHeight = isRotated90or270 ? width : height;

    return (
      <div
        key={document?.id}
        style={{
          width: containerWidth,
          height: containerHeight,
          position: "relative",
          backgroundColor: "white",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        draggable={false}
      >
        <Rotate pageSize={{ width, height }}>
          <PagePointerProvider
            pageIndex={pageIndex}
            pageWidth={width}
            pageHeight={height}
            rotation={rotation || 0}
            scale={scale}
          >
            <RenderLayer
              pageIndex={pageIndex}
              scale={scale}
              style={{ pointerEvents: "none" }}
            />
            <SearchLayer
              pageIndex={pageIndex}
              scale={scale}
              style={{ pointerEvents: "none" }}
            />
            <SelectionLayer pageIndex={pageIndex} scale={scale} />
          </PagePointerProvider>
        </Rotate>
      </div>
    );
  }, []);

  return (
    <Viewport
      style={{
        width: "100%",
        height: "100%",
        flexGrow: 1,
        backgroundColor: "#eeee",
        overflow: "auto",
      }}
    >
      <Scroller renderPage={renderPage} />
    </Viewport>
  );
});

const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(function PDFViewer(
  { pdfBuffer, onPasswordRequest },
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

  const plugins = useMemo(() => {
    if (!pdfBuffer || !isReady) return [];
    return [
      createPluginRegistration(LoaderPluginPackage, {
        loadingOptions: {
          type: "buffer",
          pdfFile: {
            id: `pdf-${Date.now()}`,
            content: pdfBuffer,
          },
          options: {
            password: password || "",
          },
        },
      }),
      createPluginRegistration(ViewportPluginPackage, {
        viewportGap: 10,
      }),
      createPluginRegistration(ScrollPluginPackage, {
        strategy: ScrollStrategy.Vertical,
      }),
      createPluginRegistration(InteractionManagerPluginPackage),
      createPluginRegistration(ZoomPluginPackage, {
        defaultZoomLevel: 1.0,
        minZoom: 0.2,
        maxZoom: 5.0,
      }),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(RotatePluginPackage),
      createPluginRegistration(SelectionPluginPackage),
      createPluginRegistration(SearchPluginPackage),
    ];
  }, [pdfBuffer, password, isReady, engine]);

  useEffect(() => {
    const ready =
      engineLoading === false &&
      engineError === null &&
      isPasswordChecked &&
      pdfBuffer instanceof ArrayBuffer;

    setIsReady(ready);
  }, [engineLoading, engineError, pdfBuffer, isPasswordChecked]);

  useEffect(() => {
    if (!pdfBuffer) {
      return;
    }

    if (isPasswordProtected(pdfBuffer)) {
      async function requestPassword() {
        let password: string | null = null;
        if (onPasswordRequest) {
          password = await onPasswordRequest();
        }
        if (password) {
          setPassword(password);
        }
        setIsPasswordChecked(true);
      }

      if (onPasswordRequest) {
        requestPassword();
      }
    } else {
      setIsPasswordChecked(true);
    }
  }, [pdfBuffer]);

  if (!isReady || !engine) {
    return null;
  }

  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      <PDFContent ref={ref} />
    </EmbedPDF>
  );
});

export default PDFViewer;
