import { useCallback, useRef, type MutableRefObject } from 'react';
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { loadImageDimensions } from './utils';

interface AnnotationAPIParams {
  annotation: any;
  currentUserInfoRef: MutableRefObject<{ author?: string; customData?: any } | null>;
  customStampToolIdRef: MutableRefObject<string | null>;
  stampSizeCacheRef: MutableRefObject<Map<string, { width: number; height: number }>>;
  setAnnotationRenderVersion: (fn: (v: number) => number) => void;
  ensureStampTool: (imageDataUrl: string, userInfo?: { author?: string; customData?: any }) => Promise<string | null>;
  waitForActiveTool: (toolId: string) => Promise<boolean>;
  waitForNextFrame: () => Promise<void>;
}

export function createAnnotationAPI(params: AnnotationAPIParams) {
  const {
    annotation,
    currentUserInfoRef,
    customStampToolIdRef,
    setAnnotationRenderVersion,
    ensureStampTool,
    waitForActiveTool,
    waitForNextFrame
  } = params;

  return {
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

        if (userInfo?.author) {
          annotationData.author = userInfo.author;
        }

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
      return selected.object;
    },
    getAllAnnotations: () => {
      if (!annotation.provides) {
        console.warn('[PDFViewer] Annotation API not available');
        return [];
      }

      const api = annotation.provides as any;

      if (typeof api.getAllAnnotations === 'function') {
        console.log('[PDFViewer] Using annotation.provides.getAllAnnotations()');
        return api.getAllAnnotations();
      }

      if (typeof api.getAnnotations === 'function') {
        console.log('[PDFViewer] Using annotation.provides.getAnnotations()');
        return api.getAnnotations();
      }

      console.warn('[PDFViewer] No direct method to get all annotations. Use onAnnotationEvent to capture annotations as they are created/updated.');
      return [];
    },

    onAnnotationEvent: (callback: (event: any) => void) => {
      if (!annotation.provides) {
        console.warn('[PDFViewer] Annotation API not available');
        return null;
      }

      const api = annotation.provides as any;

      if (typeof api.onAnnotationEvent === 'function') {
        return api.onAnnotationEvent(callback);
      }

      console.warn('[PDFViewer] onAnnotationEvent not available');
      return null;
    },

  };
}
