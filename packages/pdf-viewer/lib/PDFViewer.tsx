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
import {
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from "@embedpdf/plugin-interaction-manager/react";
import { useZoom, ZoomMode, ZoomPluginPackage } from "@embedpdf/plugin-zoom/react";

// Re-export for consuming apps
export { ZoomMode };

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
}

// Internal component that has access to plugin hooks
const PDFContent = forwardRef<PDFViewerRef>((_, ref) => {
  const zoom = useZoom();
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
  }), [zoom]);

  const renderPage = useCallback(({
    pageIndex,
    scale,
    width,
    height,
    document,
    rotation,
  }: any) => (
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
        <SelectionLayer pageIndex={pageIndex} scale={scale} />
      </PagePointerProvider>
    </div>
  ), []);

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
      createPluginRegistration(SelectionPluginPackage),
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
