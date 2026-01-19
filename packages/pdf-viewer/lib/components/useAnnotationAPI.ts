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

    updateAnnotation: (pageIndex: number, annotationId: string, updates: Record<string, unknown>) => {
      if (!annotation.provides) {
        return false;
      }

      try {
        const api = annotation.provides as any;
        
        if (api.updateAnnotation) {
          api.updateAnnotation(pageIndex, annotationId, updates);
          
          if (api.commit) {
            api.commit();
          }
          
          return true;
        }

        return false;
      } catch (error) {
        console.error('Failed to update annotation', error);
        return false;
      }
    },

    selectAnnotation: (pageIndex: number, annotationId: string) => {
      if (!annotation.provides) {
        return false;
      }

      try {
        const api = annotation.provides as any;
        
        if (api.selectAnnotation) {
          api.selectAnnotation(pageIndex, annotationId);
          return true;
        }

        return false;
      } catch (error) {
        console.error('Failed to select annotation', error);
        return false;
      }
    },

    importAnnotations: async (annotations: Array<{ pageIndex: number; annotation: Record<string, unknown>, ctx?: { imageData?: string | ArrayBuffer } }>) => {
      console.log('[useAnnotationAPI] Importing', annotations.length, 'annotations');
      
      if (!annotation.provides) {
        console.error('[useAnnotationAPI] Annotation API not available');
        return { success: 0, failed: annotations.length };
      }

      const api = annotation.provides as any;
      let successCount = 0;
      let failedCount = 0;

      // Try native bulk import first (preferred method)
      if (typeof api.importAnnotations === 'function') {
        try {
          console.log('[useAnnotationAPI] Using native bulk importAnnotations');
          // The `importAnnotations` method likely takes an array of items, where each item
          // can be just the annotation object, or an object with `annotation` and `ctx`.
          const itemsToImport = annotations.map(item => ({
            annotation: item.annotation,
            pageIndex: item.pageIndex,
            ...(item.ctx && { ctx: item.ctx }),
          }));

          console.log('[useAnnotationAPI] Items to import:', itemsToImport.map(i => ({ id: i.annotation.id, hasCtx: !!i.ctx })));

          await api.importAnnotations(itemsToImport);
          
          if (api.commit) {
            console.log('[useAnnotationAPI] Committing bulk import...');
            api.commit();
          }
          
          console.log('[useAnnotationAPI] Bulk import successful');
          setAnnotationRenderVersion((v) => v + 1); // Force re-render
          return { success: annotations.length, failed: 0 };
        } catch (error) {
          console.error('[useAnnotationAPI] Native bulk import failed:', error);
          // Fall through to manual creation
        }
      }

      // Fallback: create annotations one by one
      console.log('[useAnnotationAPI] Using createAnnotation fallback');
      for (const { pageIndex, annotation: annotationData, ctx } of annotations) {
        try {
          if (!api.createAnnotation) {
            console.error('[useAnnotationAPI] createAnnotation method not available');
            failedCount++;
            continue;
          }

          // Ensure the annotation data is properly formatted
          const formattedAnnotation = {
            ...annotationData,
            id: annotationData.id || undefined,
            name: annotationData.name || annotationData.id || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };

          console.log(`[useAnnotationAPI] Creating annotation on page ${pageIndex}:`, formattedAnnotation.id || formattedAnnotation.name);
          
          // Enhanced context with multiple potential keys for image data
          const enhancedCtx = ctx ? {
            ...ctx,
            image: ctx.imageData || ctx.image, // Try 'image' key as well
            data: ctx.imageData, // Try 'data' key
          } : undefined;

          // Pass context if it exists
          api.createAnnotation(pageIndex, formattedAnnotation, enhancedCtx);
          
          // Commit immediately for each stamp to ensure appearance generation
          if (formattedAnnotation.type === PdfAnnotationSubtype.STAMP && api.commit) {
             api.commit();
             // Small delay to allow engine to process
             await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          successCount++;
        } catch (error) {
          console.error(`[useAnnotationAPI] Failed to create annotation on page ${pageIndex}:`, error);
          failedCount++;
        }
      }

      // Final commit for any remaining changes
      if (api.commit) {
        try {
          console.log(`[useAnnotationAPI] Committing ${successCount} created annotations...`);
          api.commit();
          console.log('[useAnnotationAPI] Commit successful');
          
          // Force a re-render by triggering state update
          if (setAnnotationRenderVersion) {
            console.log('[useAnnotationAPI] Forcing re-render...');
            setAnnotationRenderVersion((v) => v + 1);
          }
        } catch (error) {
          console.error('[useAnnotationAPI] Failed to commit imported annotations:', error);
        }
      }

      console.log(`[useAnnotationAPI] Import complete. Success: ${successCount}, Failed: ${failedCount}`);
      return { success: successCount, failed: failedCount };
    },

    onStateChange: (callback: (state: unknown) => void) => {
      if (!annotation.provides) {
        return null;
      }

      const api = annotation.provides as any;

      if (api.onStateChange) {
        return api.onStateChange(callback);
      }

      return null;
    },

  };
}
