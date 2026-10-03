import type { Kernel, StageCapability } from "@embedpdf/react";
import { degreesToRotation, rotationToDegrees, ScrollStrategy } from "../compat";
import type { PDFViewerProps, PDFViewerRef } from "../types/public";

interface Context {
  kernel: Kernel;
  stage: StageCapability;
  documentId: string;
  pdfBuffer: PDFViewerProps["pdfBuffer"];
}

const toBlobPart = (bytes: Uint8Array): BlobPart => bytes as unknown as BlobPart;

const saveToFile = (bytes: Uint8Array, filename: string) => {
  const url = URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// Prints PDF bytes through a hidden iframe (EmbedPDF 3 has no print plugin).
const printBytes = (bytes: Uint8Array) =>
  new Promise<void>((resolve) => {
    const url = URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: "application/pdf" }));
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    frame.src = url;
    const cleanup = () => {
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
      resolve();
    };
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        cleanup();
      }
    };
    document.body.appendChild(frame);
  });

const originalBytes = (pdfBuffer: PDFViewerProps["pdfBuffer"]): Uint8Array | null =>
  pdfBuffer ? (pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer as ArrayBuffer)) : null;

type DocumentApi = Pick<PDFViewerRef, "zoom" | "navigation" | "document" | "scroll" | "rotate" | "download" | "print">;

// zoom, navigation, rotation, document info, download and print — everything
// that only needs the document registry and the stage.
export const createDocumentApi = ({ kernel, stage, documentId, pdfBuffer }: Context): DocumentApi => {
  const totalPages = () => stage.pageCount();
  const currentPage = () => stage.currentPage() + 1;
  const goToPage = (page: number) => stage.goToPage(Math.min(Math.max(page, 1), Math.max(totalPages(), 1)) - 1);
  const zoomValue = () => stage.zoomLevel();
  const zoomIntent = () => {
    const mode = stage.zoomMode();
    return mode === "custom" ? stage.zoomLevel() : mode;
  };
  const saveBytes = () => kernel.documents.download(documentId);

  return {
    zoom: {
      zoomIn: () => stage.zoomIn(),
      zoomOut: () => stage.zoomOut(),
      setZoom: (level) => stage.zoomTo({ level }),
      resetZoom: () => stage.fitPage(),
      getZoom: zoomValue,
      fitToWidth: () => stage.fitWidth(),
      fitToPage: () => stage.fitPage(),
    },
    navigation: {
      goToPage,
      getCurrentPage: currentPage,
      getTotalPages: totalPages,
      nextPage: () => stage.next(),
      previousPage: () => stage.prev(),
      goToFirstPage: () => stage.goToPage(0),
      goToLastPage: () => stage.goToPage(Math.max(totalPages() - 1, 0)),
      setScrollStrategy: (strategy) => stage.setLayout(strategy === ScrollStrategy.Horizontal ? "horizontal" : "vertical"),
      getLayout: () => stage.settings(),
      setTwoPageMode: (enabled) => stage.setSpread(enabled ? "odd" : "none"),
      getTwoPageMode: () => stage.spread() !== "none",
      onPageChange: (listener) => {
        let last = stage.currentPage();
        return kernel.subscribe(() => {
          const now = stage.currentPage();
          if (now !== last) {
            last = now;
            listener({ pageNumber: now + 1, pageIndex: now });
          }
        });
      },
    },
    document: {
      isReady: () => kernel.documents.get(documentId)?.status === "ready",
      isLoading: () => kernel.documents.get(documentId)?.status === "loading",
      hasPassword: () => kernel.documents.get(documentId)?.status === "locked",
      getDocumentInfo: () => ({
        currentPage: currentPage(),
        totalPages: totalPages(),
        zoomLevel: zoomIntent(),
        hasActiveSearch: false,
      }),
    },
    scroll: {
      scrollToPage: ({ pageNumber }) => goToPage(pageNumber),
    },
    rotate: {
      rotateForward: () => stage.rotateView(90),
      rotateBackward: () => stage.rotateView(-90),
      setRotation: (rotation) => stage.setViewRotation(rotationToDegrees(rotation)),
      getRotation: () => degreesToRotation(stage.viewRotation()),
    },
    download: {
      downloadWithAnnotations: async (filename = "document-with-annotations.pdf") => {
        try {
          saveToFile(await saveBytes(), filename);
        } catch (error) {
          console.error("Error downloading PDF with annotations:", error);
        }
      },
      downloadWithoutAnnotations: async (filename = "document-original.pdf") => {
        const bytes = originalBytes(pdfBuffer);
        if (!bytes) {
          console.error("Original PDF buffer not available");
          return;
        }
        saveToFile(bytes, filename);
      },
    },
    print: {
      printWithAnnotations: async () => printBytes(await saveBytes()),
      printWithoutAnnotations: async () => {
        const bytes = originalBytes(pdfBuffer);
        if (bytes) await printBytes(bytes);
      },
    },
  };
};
