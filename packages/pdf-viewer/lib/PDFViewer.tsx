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
import {
  useZoom,
  ZoomMode,
  ZoomPluginPackage,
} from "@embedpdf/plugin-zoom/react";
import { useSearch } from "@embedpdf/plugin-search/react";
import { useScroll } from "@embedpdf/plugin-scroll/react";
import {
  AnnotationLayer,
  useAnnotationCapability,
} from "@embedpdf/plugin-annotation/react";
import {
  useExportCapability,
  useExportPlugin,
} from "@embedpdf/plugin-export/react";

// Re-export for consuming apps
export { ZoomMode };
export type { SearchState } from "@embedpdf/plugin-search";
export type {
  SearchResult,
  SearchAllPagesResult,
  MatchFlag,
} from "@embedpdf/models";

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
import { AnnotationPluginPackage } from "@embedpdf/plugin-annotation";
import { HistoryPluginPackage } from "@embedpdf/plugin-history";
import { ExportPluginPackage } from "@embedpdf/plugin-export";

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
    download: (
      filename?: string,
      includeAnnotations?: boolean,
    ) => Promise<void>;
  };
  scroll: {
    scrollToPage: (options: {
      pageNumber: number;
      pageCoordinates?: { x: number; y: number };
      center?: boolean;
    }) => void;
  };
  annotations: {
    setActiveTool: (toolId: string | null) => void;
    getActiveTool: () => any;
    getSelectedAnnotation: () => any;
    deleteAnnotation: (pageIndex: number, id: string) => void;
    deleteSelected: () => void;
    getProvider: () => any;
  };
}

// Internal component that has access to plugin hooks
const PDFContent = forwardRef<
  PDFViewerRef,
  { isReady: boolean; isLoading: boolean; hasPassword: boolean }
>(({ isReady, isLoading, hasPassword }, ref) => {
  const zoom = useZoom();
  const search = useSearch();
  const scroll = useScroll();
  const annotationCapability = useAnnotationCapability();
  const exportCapability = useExportCapability();
  const exportPlugin = useExportPlugin();

  // Debug annotation capability
  useEffect(() => {
    // Annotation capability debug removed
  }, [annotationCapability]);

  useImperativeHandle(
    ref,
    () => ({
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
          if (scroll.provides) {
            scroll.provides.scrollToPage({ pageNumber: page });
          }
        },
        getCurrentPage: () => {
          if (scroll.state) {
            return scroll.state.currentPage || 1; // Use currentPage property
          }
          return 1;
        },
        getTotalPages: () => {
          if (scroll.state) {
            return scroll.state.totalPages || 1;
          }
          return 1;
        },
        nextPage: () => {
          const currentPage = scroll.state?.currentPage || 1;
          const totalPages = scroll.state?.totalPages || 1;
          if (currentPage < totalPages && scroll.provides) {
            scroll.provides.scrollToPage({ pageNumber: currentPage + 1 });
          }
        },
        previousPage: () => {
          const currentPage = scroll.state?.currentPage || 1;
          if (currentPage > 1 && scroll.provides) {
            scroll.provides.scrollToPage({ pageNumber: currentPage - 1 });
          }
        },
        goToFirstPage: () => {
          if (scroll.provides) {
            scroll.provides.scrollToPage({ pageNumber: 1 });
          }
        },
        goToLastPage: () => {
          const totalPages = scroll.state?.totalPages || 1;
          if (scroll.provides) {
            scroll.provides.scrollToPage({ pageNumber: totalPages });
          }
        },
      },
      selection: {
        clearSelection: () => {
          // TODO: Implement when selection plugin hook is available
          // clearSelection not yet implemented
        },
        getSelectedText: () => {
          // TODO: Implement when selection plugin hook is available
          // getSelectedText not yet implemented
          return "";
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
      document: {
        isReady: () => isReady,
        isLoading: () => isLoading,
        hasPassword: () => hasPassword,
        getDocumentInfo: () => ({
          currentPage: scroll.state?.currentPage || 1,
          totalPages: scroll.state?.totalPages || 1,
          zoomLevel: zoom.state?.zoomLevel || 1.0,
          hasActiveSearch: Boolean(search.state),
        }),
        download: async (
          filename?: string,
          includeAnnotations: boolean = true,
        ) => {
          // Download functionality - TODO: implement
        },
      },
      scroll: {
        scrollToPage: (options: {
          pageNumber: number;
          pageCoordinates?: { x: number; y: number };
          center?: boolean;
        }) => {
          if (scroll.provides) {
            scroll.provides.scrollToPage(options);
          }
        },
      },
      annotations: {
        setActiveTool: (toolId: string | null) => {
          if (annotationCapability?.provides) {
            annotationCapability.provides.setActiveTool(toolId);
          }
        },
        getActiveTool: () => {
          if (annotationCapability?.provides) {
            return annotationCapability.provides.getActiveTool();
          }
          return null;
        },
        getProvider: () => {
          return annotationCapability?.provides || null;
        },
        getSelectedAnnotation: () => {
          if (annotationCapability?.provides) {
            return annotationCapability.provides.getSelectedAnnotation();
          }
          return null;
        },
        deleteAnnotation: (pageIndex: number, id: string) => {
          if (annotationCapability?.provides) {
            annotationCapability.provides.deleteAnnotation(pageIndex, id);
          }
        },
        deleteSelected: () => {
          if (annotationCapability?.provides) {
            const selection =
              annotationCapability.provides.getSelectedAnnotation();
            if (selection) {
              annotationCapability.provides.deleteAnnotation(
                selection.object.pageIndex,
                selection.object.id,
              );
            }
          }
        },
      },
    }),
    [
      zoom,
      search,
      scroll,
      isReady,
      isLoading,
      hasPassword,
      annotationCapability,
      exportCapability,
      exportPlugin,
    ],
  );

  const renderPage = useCallback(
    ({ pageIndex, scale, width, height, document, rotation }: any) => (
      <div
        key={document?.id}
        style={{
          width,
          height,
          position: "relative",
          backgroundColor: "white",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        draggable={false}
      >
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
          <AnnotationLayer
            pageIndex={pageIndex}
            scale={scale}
            pageWidth={width}
            pageHeight={height}
            rotation={rotation || 0}
          />
          <SelectionLayer pageIndex={pageIndex} scale={scale} />
        </PagePointerProvider>
      </div>
    ),
    [],
  );

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
  ref,
): ReactElement | null {
  const {
    engine,
    isLoading: engineLoading,
    error: engineError,
  } = usePdfiumEngine({ wasmUrl: "/workers/pdfium.wasm", worker: true });

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
      createPluginRegistration(SelectionPluginPackage),
      createPluginRegistration(HistoryPluginPackage),
      createPluginRegistration(AnnotationPluginPackage, {
        annotationAuthor: "User", // Optional
      }),
      createPluginRegistration(ZoomPluginPackage, {
        defaultZoomLevel: 1.0,
        minZoom: 0.2,
        maxZoom: 5.0,
      }),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(SearchPluginPackage),
      createPluginRegistration(ExportPluginPackage),
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
      <PDFContent
        ref={ref}
        isReady={isReady}
        isLoading={engineLoading}
        hasPassword={
          Boolean(password) ||
          isPasswordProtected(pdfBuffer || new ArrayBuffer(0))
        }
      />
    </EmbedPDF>
  );
});

export default PDFViewer;
