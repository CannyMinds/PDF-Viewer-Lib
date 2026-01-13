import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePdfiumEngine } from "@embedpdf/engines/react";
import { createPluginRegistration } from '@embedpdf/core';
import { DocumentManagerPluginPackage } from "@embedpdf/plugin-document-manager";
import { ViewportPluginPackage } from "@embedpdf/plugin-viewport";
import { ScrollPluginPackage } from "@embedpdf/plugin-scroll";
import { RenderPluginPackage } from "@embedpdf/plugin-render";
import { SelectionPluginPackage } from "@embedpdf/plugin-selection";
import { InteractionManagerPluginPackage } from "@embedpdf/plugin-interaction-manager";
import { ZoomPluginPackage } from "@embedpdf/plugin-zoom";
import { HistoryPluginPackage } from "@embedpdf/plugin-history";
import { AnnotationPluginPackage } from "@embedpdf/plugin-annotation";
import isPasswordProtected from "./utils/isPasswordProtected";
import { validatePDFBuffer } from "./utils/validatePDFBuffer";
import { type PDFError, PDFErrorType, createPDFError } from "./utils/errorTypes";

interface PDFViewerOptions {
    pdfBuffer?: ArrayBuffer | null | undefined;
    password?: string;
}

export interface PDFViewerInstance {
    setPassword: (password: string) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    requestZoom: (level: number) => void;
    getCurrentPage: () => number | null;
    setPage: (page: number) => void;
    getTotalPages: () => number | null;
    setPasswordChecked: (checked: boolean) => void;
    setIsPasswordChecked: (checked: boolean) => void;
}

export interface PDFViewerHookReturn {
    engine: any;
    plugins: any[];
    isLoading: boolean;
    error: PDFError | null;
    isReady: boolean;
    instance: PDFViewerInstance;
}

export function usePDFViewer({ pdfBuffer, password: initialPassword }: PDFViewerOptions): PDFViewerHookReturn {
    const { engine, isLoading: engineLoading, error: engineError } = usePdfiumEngine();
    const [error, setError] = useState<PDFError | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [password, setPassword] = useState(initialPassword || "");
    const [isPasswordChecked, setIsPasswordChecked] = useState(false);

    const isLoading = engineLoading;

    // Reset states when pdfBuffer changes
    useEffect(() => {
        if (pdfBuffer) {
            setError(null);
            setIsReady(false);
            setIsPasswordChecked(false);
        }
    }, [pdfBuffer]);

    // Handle engine errors
    useEffect(() => {
        if (engineError) {
            setError(createPDFError(
                PDFErrorType.ENGINE,
                `PDFium engine error: ${engineError.message || engineError}`,
                engineError
            ));
        }
    }, [engineError]);

    // Validate PDF buffer and wait for password check
    useEffect(() => {
        if (!pdfBuffer || !isPasswordChecked) {
            setIsReady(false);
            return;
        }

        const validation = validatePDFBuffer(pdfBuffer);
        if (!validation.isValid) {
            setError(createPDFError(
                PDFErrorType.VALIDATION,
                validation.error || "Invalid PDF buffer"
            ));
            setIsReady(false);
            return;
        }

        // PDF is valid and password has been checked by component
        setIsReady(true);
    }, [pdfBuffer, password, isPasswordChecked]);

    const plugins = useMemo(() => {
        if (!pdfBuffer || !isReady) return [];

        return [
            createPluginRegistration(DocumentManagerPluginPackage, {
                initialDocuments: [{
                    buffer: pdfBuffer as ArrayBuffer,
                    name: 'document.pdf',
                    autoActivate: true,
                    ...(password ? { password } : {}),
                }],
            }),
            createPluginRegistration(ViewportPluginPackage, {
                viewportGap: 10,
            }),
            createPluginRegistration(ScrollPluginPackage),
            createPluginRegistration(InteractionManagerPluginPackage),
            createPluginRegistration(ZoomPluginPackage, {
                defaultZoomLevel: 1.0,
                minZoom: 0.2,
                maxZoom: 5.0,
            }),
            createPluginRegistration(RenderPluginPackage),
            createPluginRegistration(SelectionPluginPackage),
            createPluginRegistration(HistoryPluginPackage),
            createPluginRegistration(AnnotationPluginPackage, {
                annotationAuthor: "User",
            }),
        ];
    }, [pdfBuffer, password, isReady]);

    const instance: PDFViewerInstance = useMemo(() => ({
        setPassword: (newPassword: string) => {
            setPassword(newPassword);
        },
        setPasswordChecked: (checked: boolean) => {
            setIsPasswordChecked(checked);
        },
        setIsPasswordChecked: (checked: boolean) => {
            setIsPasswordChecked(checked);
        },
        zoomIn: () => {
            console.warn('[usePDFViewer] zoomIn() is not available from the hook instance. Use the PDFViewer component ref API instead: pdfViewerRef.current.zoom.zoomIn()');
        },
        zoomOut: () => {
            console.warn('[usePDFViewer] zoomOut() is not available from the hook instance. Use the PDFViewer component ref API instead: pdfViewerRef.current.zoom.zoomOut()');
        },
        requestZoom: (level: number) => {
            console.warn('[usePDFViewer] requestZoom() is not available from the hook instance. Use the PDFViewer component ref API instead: pdfViewerRef.current.zoom.setZoom(level)');
        },
        getCurrentPage: () => {
            console.warn('[usePDFViewer] getCurrentPage() is not available from the hook instance. Use the PDFViewer component ref API instead: pdfViewerRef.current.navigation.getCurrentPage()');
            return null;
        },
        setPage: (page: number) => {
            console.warn('[usePDFViewer] setPage() is not available from the hook instance. Use the PDFViewer component ref API instead: pdfViewerRef.current.navigation.goToPage(page)');
        },
        getTotalPages: () => {
            console.warn('[usePDFViewer] getTotalPages() is not available from the hook instance. Use the PDFViewer component ref API instead: pdfViewerRef.current.navigation.getTotalPages()');
            return null;
        }
    }), []);

    return {
        engine,
        plugins,
        isLoading,
        error,
        isReady,
        instance
    };
}