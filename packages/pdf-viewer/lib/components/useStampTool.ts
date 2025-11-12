import { useCallback, useRef, type MutableRefObject } from 'react';
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { loadImageDimensions } from './utils';
import { svgToPngDataUrl } from './svgUtils';

interface UseStampToolParams {
  annotation: any;
  customStampToolIdRef: MutableRefObject<string | null>;
  stampSizeCacheRef: MutableRefObject<Map<string, { width: number; height: number }>>;
}

export function useStampTool(params: UseStampToolParams) {
  const { annotation, customStampToolIdRef, stampSizeCacheRef } = params;

  const ensureStampTool = useCallback(async (imageDataUrl: string, userInfo?: { author?: string; customData?: any }, isSvg: boolean = false) => {
    if (!annotation.provides) {
      return null;
    }

    try {
      console.debug("[PDFViewer] ensureStampTool", { imageDataUrl: imageDataUrl.slice(0, 32), userInfo });
      const cached = stampSizeCacheRef.current.get(imageDataUrl);
      let finalImageDataUrl = imageDataUrl;
      
      // Convert SVG to PNG for better PDF compatibility
      if (isSvg && imageDataUrl.startsWith('data:image/svg+xml')) {
        finalImageDataUrl = await svgToPngDataUrl(decodeURIComponent(imageDataUrl.split(',')[1]), 200, 100);
      }
      
      const { width, height } = cached ?? (await loadImageDimensions(finalImageDataUrl));
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
          imageSrc: finalImageDataUrl,
          imageSize: { width: toolWidth, height: toolHeight },
          originalSvg: isSvg ? imageDataUrl : undefined,
        };

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
          imageSrc: finalImageDataUrl,
          imageSize: { width: toolWidth, height: toolHeight },
          originalSvg: isSvg ? imageDataUrl : undefined,
        });
      }

      return toolId;
    } catch (error) {
      console.error("[PDFViewer] Failed to ensure stamp tool", error);
      return null;
    }
  }, [annotation.provides, customStampToolIdRef, stampSizeCacheRef]);

  const waitForActiveTool = useCallback(async (toolId: string): Promise<boolean> => {
    if (!annotation.provides) {
      console.warn("Cannot wait for tool: annotation API unavailable");
      return false;
    }

    const startTime = Date.now();
    const timeout = 5000;

    while (Date.now() - startTime < timeout) {
      const currentTool = annotation.provides.getActiveTool();
      if (currentTool && currentTool.id === toolId) {
        return true;
      }
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }

    console.warn(`[PDFViewer] Tool ${toolId} did not activate within ${timeout}ms`);
    return false;
  }, [annotation.provides]);

  const waitForNextFrame = useCallback(async () => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      return;
    }

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }, []);

  return {
    ensureStampTool,
    waitForActiveTool,
    waitForNextFrame,
  };
}
