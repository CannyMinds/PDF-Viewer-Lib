import { useCallback, useRef, type MutableRefObject } from 'react';
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { loadImageDimensions } from './utils';
import type { AnnotationPlugin, AnnotationEvent, AnnotationObject } from '../types/embedpdf';

export interface UserInfo {
  author?: string;
  customData?: unknown;
}

interface AnnotationAPIParams {
  annotation: AnnotationPlugin;
  currentUserInfoRef: MutableRefObject<UserInfo | null>;
  customStampToolIdRef: MutableRefObject<string | null>;
  stampSizeCacheRef: MutableRefObject<Map<string, { width: number; height: number }>>;
  setAnnotationRenderVersion: (fn: (v: number) => number) => void;
  ensureStampTool: (imageDataUrl: string, userInfo?: UserInfo) => Promise<string | null>;
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
        return;
      }

      if (!imageDataUrl) {
        annotation.provides.setActiveTool('stamp');
        return;
      }

      try {
        const toolId = await ensureStampTool(imageDataUrl, currentUserInfoRef.current || undefined);
        if (!toolId || !annotation.provides) return;

        annotation.provides.setActiveTool(null);
        await waitForNextFrame();
        annotation.provides.setActiveTool(toolId);
        const activated = await waitForActiveTool(toolId);
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
    addStampAnnotation: (imageDataUrl: string, pageIndex: number, x: number, y: number, width: number, height: number, userInfo?: UserInfo) => {
      if (!annotation.provides) {
        return false;
      }

      try {
        const api = annotation.provides;
        if (!api.createAnnotation) {
          return false;
        }

        const annotationData: Record<string, unknown> = {
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
    getAllAnnotations: (): AnnotationObject[] => {
      if (!annotation.provides) {
        return [];
      }

      const api = annotation.provides;

      if (api.getAllAnnotations) {
        return api.getAllAnnotations();
      }

      if (api.getAnnotations) {
        return api.getAnnotations();
      }

      return [];
    },

    onAnnotationEvent: (callback: (event: AnnotationEvent) => void) => {
      if (!annotation.provides) {
        return null;
      }

      const api = annotation.provides;

      if (api.onAnnotationEvent) {
        return api.onAnnotationEvent(callback);
      }

      return null;
    },

  };
}
