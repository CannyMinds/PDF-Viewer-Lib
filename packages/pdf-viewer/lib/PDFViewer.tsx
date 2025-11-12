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
} from "@embedpdf/plugin-annotation/react";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { HistoryPluginPackage } from "@embedpdf/plugin-history";
import { Rotation } from "@embedpdf/models";

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
  useRef,
  type CSSProperties,
} from "react";

import isPasswordProtected from "./utils/isPasswordProtected";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import { createPluginRegistration } from "@embedpdf/core";
import { LoaderPluginPackage } from "@embedpdf/plugin-loader";
import { SelectionPluginPackage } from "@embedpdf/plugin-selection";
import { SearchPluginPackage } from "@embedpdf/plugin-search";

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
  createZoomAPI,
  createNavigationAPI,
  createSearchAPI,
  createRotateAPI,
  createDownloadAPI,
  createStatusAPI,
  createScrollAPI
} from "./components";

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
  onPasswordRequest?: (callback: (password: string) => void) => void;
  annotationSelectionMenu?: AnnotationSelectionMenu;
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
    addStampAnnotation: (imageDataUrl: string, pageIndex: number, x: number, y: number, width: number, height: number, userInfo?: { author?: string; customData?: any }) => boolean;
    addSignatureAnnotation: (signatureDataUrl: string, pageIndex: number, x: number, y: number, width: number, height: number) => boolean;
    deleteSelectedAnnotation: () => boolean;
    getSelectedAnnotation: () => any;
    getSelectedAnnotationDetails: () => any;
    getAllAnnotations: () => any[];
    getAllAnnotationsWithMetadata: () => any[];
    exportAnnotationsAsJSON: () => string;
    onAnnotationEvent: (callback: (event: any) => void) => (() => void) | null;
  enableClickToPlace: (callback: (clickData: { pageIndex: number; x: number; y: number; pageWidth?: number; pageHeight?: number }) => void) => void;
    placeStampAtPosition: (imageDataUrl: string, pageIndex: number, x: number, y: number) => void;
  };
  download: {
    downloadWithAnnotations: (filename?: string) => Promise<void>;
    downloadWithoutAnnotations: (filename?: string) => Promise<void>;
  };
}

// Internal component that has access to plugin hooks
const PDFContent = forwardRef<PDFViewerRef, { isReady: boolean; isLoading: boolean; hasPassword: boolean; annotationSelectionMenu?: AnnotationSelectionMenu; pdfBuffer?: Uint8Array | null; engine: any; userDetails?: { name?: string; email?: string; id?: string; [key: string]: any } }>(({ isReady, isLoading, hasPassword, annotationSelectionMenu, pdfBuffer, engine, userDetails }, ref) => {
  const zoom = useZoom();
  const search = useSearch();
  const scroll = useScroll();
  const rotate = useRotate();
  const annotation = useAnnotationCapability();
  
  // Track annotations with metadata
  const [annotationsMetadata, setAnnotationsMetadata] = useState<Map<string, any>>(new Map());
  
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

  // Update user info ref when userDetails change
  useEffect(() => {
    if (userDetails) {
      currentUserInfoRef.current = {
        author: userDetails.name || userDetails.email || 'Guest',
        customData: userDetails
      };
    }
  }, [userDetails]);

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
          interaction: { exclusive: false, cursor: "crosshair" },
          matchScore: () => 1,
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
          annotation.provides?.onActiveToolChange((tool) => {
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
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [annotation.provides, userDetails]);

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
    },
    scroll: {
      scrollToPage: (options: { pageNumber: number; pageCoordinates?: { x: number; y: number }; center?: boolean }) => {
        if (scroll.provides) {
          scroll.provides.scrollToPage(options);
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
        const selection = annotation.provides.getSelectedAnnotation();
        if (!selection) return false;
        annotation.provides.deleteAnnotation(selection.object.pageIndex, selection.object.id);
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
            totalPages: scroll.state?.totalPages || 0,
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
    },
    download: {
      downloadWithAnnotations: async (filename = 'document-with-annotations.pdf') => {
        if (!engine) {
          console.error('Engine not available');
          return;
        }
        try {
          const pdfBytes = await engine.saveAsCopy();
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
  }), [zoom, search, scroll, rotate, annotation, engine, pdfBuffer, isReady, isLoading, hasPassword, ensureStampTool, waitForActiveTool]);

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

    return (
      <div
        style={{
          width: containerWidth,
          height: containerHeight,
          position: "relative",
          backgroundColor: "white",
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: clickToPlaceCallbackRef.current ? 'crosshair' : 'default',
        }}
        draggable={false}
        onClick={handlePageClick}
      >
        <Rotate
          key={`${document?.id ?? 'doc'}-${pageIndex}-${annotationRenderVersion}`}
          pageSize={{ width, height }}
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
            <SelectionLayer pageIndex={pageIndex} scale={scale} />
            {annotationSelectionMenu ? (
              <AnnotationLayer
                pageIndex={pageIndex}
                scale={scale}
                pageWidth={width}
                pageHeight={height}
                rotation={rotation || 0}
                selectionMenu={annotationSelectionMenu}
              />
            ) : (
              <AnnotationLayer
                pageIndex={pageIndex}
                scale={scale}
                pageWidth={width}
                pageHeight={height}
                rotation={rotation || 0}
              />
            )}
          </PagePointerProvider>
        </Rotate>
      </div>
    );
  }, [annotationRenderVersion, annotationSelectionMenu]);

  return (
    <GlobalPointerProvider>
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
    </GlobalPointerProvider>
  );
});

const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(function PDFViewer(
  { pdfBuffer, onPasswordRequest, annotationSelectionMenu, userDetails },
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

  // Log engine errors
  useEffect(() => {
    if (engineError) {
      console.error('[PDFViewer] Engine error:', engineError);
      console.error('[PDFViewer] Engine error details:', JSON.stringify(engineError, null, 2));
    }
  }, [engineError]);

  const plugins = useMemo(() => {
    if (!pdfBuffer || !isReady) return [];
    
    console.log('[PDFViewer] Creating plugins with pdfBuffer:', {
      type: pdfBuffer.constructor.name,
      byteLength: pdfBuffer.byteLength,
      hasBuffer: !!pdfBuffer.buffer
    });

    try {
      return [
        createPluginRegistration(LoaderPluginPackage, {
          loadingOptions: {
            type: "buffer",
            pdfFile: {
              id: `pdf-${Date.now()}`,
              content: pdfBuffer.buffer as ArrayBuffer,
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
      createPluginRegistration(HistoryPluginPackage),
      createPluginRegistration(AnnotationPluginPackage, {
        annotationAuthor: "User",
      }),
    ];
    } catch (error) {
      console.error('[PDFViewer] Error creating plugins:', error);
      return [];
    }
  }, [pdfBuffer, password, isReady, engine]);

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
      isPasswordChecked &&
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
  }, [engineLoading, engineError, pdfBuffer, isPasswordChecked]);

  useEffect(() => {
    if (!pdfBuffer) {
      return;
    }

    if (isPasswordProtected(pdfBuffer)) {
      async function requestPassword() {
        let password: string | null = null;
        if (onPasswordRequest) {
          onPasswordRequest((pwd) => {
            password = pwd;
            if (password) {
              setPassword(password);
            }
            setIsPasswordChecked(true);
          });
        }
      }

      if (onPasswordRequest) {
        requestPassword();
      }
    } else {
      setIsPasswordChecked(true);
    }
  }, [pdfBuffer, onPasswordRequest]);

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
    <EmbedPDF engine={engine} plugins={plugins}>
      <PDFContent
        ref={ref}
        isReady={isReady}
        isLoading={engineLoading}
        hasPassword={Boolean(password) || isPasswordProtected(pdfBuffer || new ArrayBuffer(0))}
        pdfBuffer={pdfBuffer || null}
        engine={engine}
        {...(userDetails ? { userDetails } : {})}
        {...(annotationSelectionMenu ? { annotationSelectionMenu } : {})}
      />
    </EmbedPDF>
  );
});

export default PDFViewer;
