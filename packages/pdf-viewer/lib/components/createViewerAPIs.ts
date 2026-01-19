import { ZoomMode } from "@embedpdf/plugin-zoom/react";
import { Rotation } from "@embedpdf/models";
import type { ZoomPlugin, ScrollPlugin, SearchPlugin, RotatePlugin } from '../types/embedpdf';

interface CreateAPIsParams {
  zoom: ZoomPlugin;
  scroll: ScrollPlugin;
  search: SearchPlugin;
  rotate: RotatePlugin;
  engine: unknown;
  pdfBuffer?: ArrayBuffer | null;
  isReady: boolean;
  isLoading: boolean;
  hasPassword: boolean;
}

export function createZoomAPI(zoom: ZoomPlugin) {
  return {
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
        zoom.provides.setZoom(level);
      }
    },
    resetZoom: () => {
      if (zoom.provides) {
        zoom.provides.setZoom(1.0);
      }
    },
    getZoom: () => {
      if (zoom.provides && zoom.state) {
        return zoom.state.zoomLevel || 1.0;
      }
      return 1.0;
    },
    fitToWidth: () => {
      if (zoom.provides) {
        zoom.provides.setZoom(ZoomMode.FitToWidth);
      }
    },
    fitToPage: () => {
      if (zoom.provides) {
        zoom.provides.setZoom(ZoomMode.FitToPage);
      }
    },
  };
}

export function createNavigationAPI(scroll: ScrollPlugin) {
  return {
    goToPage: (page: number) => {
      if (scroll.provides) {
        scroll.provides.scrollToPage({ pageNumber: page });
      }
    },
    getCurrentPage: () => {
      return scroll.state?.currentPage || 1;
    },
    getTotalPages: () => {
      return scroll.state?.totalPages || 1;
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
  };
}

export function createSearchAPI(search: SearchPlugin, scroll: ScrollPlugin) {
  return {
    searchText: async (text: string, options?: Record<string, unknown>) => {
      if (!search.provides) {
        console.warn('Search API not available');
        return null;
      }
      return await search.provides.search(text, options);
    },
    searchAll: async (text: string, options?: Record<string, unknown>) => {
      if (!search.provides) {
        console.warn('Search API not available');
        return null;
      }
      return await search.provides.searchAllPages(text, options);
    },
    clearSearch: () => {
      if (search.provides) {
        search.provides.clearSearch();
      }
    },
    getSearchState: () => {
      return search.state || null;
    },
    highlightSearchResults: (results: any[]) => {
      if (search.provides) {
        search.provides.highlightResults(results);
      }
    },
    scrollToSearchResult: (result: Record<string, unknown>) => {
      if (result && result.pageIndex !== undefined && scroll.provides) {
        scroll.provides.scrollToPage({
          pageNumber: result.pageIndex + 1,
          pageCoordinates: result.coordinates,
          center: true
        });
      }
    },
  };
}

export function createRotateAPI(rotate: RotatePlugin) {
  return {
    rotateClockwise: () => {
      if (rotate.provides) {
        rotate.provides.rotateForward();
      }
    },
    rotateCounterClockwise: () => {
      if (rotate.provides) {
        rotate.provides.rotateBackward();
      }
    },
    resetRotation: () => {
      if (rotate.provides) {
        rotate.provides.setRotation(Rotation.Degree0);
      }
    },
    getRotation: () => {
      if (rotate.provides) {
        return rotate.provides.getRotation();
      }
      return Rotation.Degree0;
    },
    setRotation: (rotation: Rotation) => {
      if (rotate.provides) {
        rotate.provides.setRotation(rotation);
      }
    },
  };
}

export function createDownloadAPI(params: CreateAPIsParams) {
  const { engine, pdfBuffer } = params;

  return {
    downloadWithAnnotations: async (filename?: string) => {
      if (!engine) {
        console.error('Cannot download: PDF engine not available');
        return;
      }

      try {
        const pdfBytes = await engine.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `document-with-annotations-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading PDF with annotations:', error);
      }
    },
    downloadWithoutAnnotations: async (filename?: string) => {
      if (!pdfBuffer) {
        console.error('Cannot download: PDF buffer not available');
        return;
      }

      try {
        const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `original-document-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading original PDF:', error);
      }
    },
  };
}

export function createStatusAPI(params: CreateAPIsParams) {
  const { isReady, isLoading, hasPassword, scroll, zoom, search } = params;

  return {
    isReady: () => isReady,
    isLoading: () => isLoading,
    hasPassword: () => hasPassword,
    getDocumentInfo: () => ({
      currentPage: scroll.state?.currentPage || 1,
      totalPages: scroll.state?.totalPages || 1,
      zoomLevel: zoom.state?.zoomLevel || 1.0,
      hasActiveSearch: Boolean(search.state),
    }),
  };
}

export function createScrollAPI(scroll: ScrollPlugin) {
  return {
    scrollToPage: (options: { pageNumber: number; pageCoordinates?: { x: number; y: number }; center?: boolean }) => {
      if (scroll.provides) {
        scroll.provides.scrollToPage(options);
      }
    },
  };
}
