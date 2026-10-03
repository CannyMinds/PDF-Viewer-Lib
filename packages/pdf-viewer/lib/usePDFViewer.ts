import { useState, useEffect, useMemo } from 'react';
import { validatePDFBuffer } from "./utils/validatePDFBuffer";
import { type PDFError, PDFErrorType, createPDFError } from "./utils/errorTypes";
import { createEngine, viewerPlugins } from "./runtime";

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
    const [error, setError] = useState<PDFError | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [password, setPassword] = useState(initialPassword || "");
    const [isPasswordChecked, setIsPasswordChecked] = useState(false);

    // The engine boots lazily inside <Viewer>, so there is nothing to wait for here.
    const isLoading = false;

    // Reset states when pdfBuffer changes
    useEffect(() => {
        if (pdfBuffer) {
            setError(null);
            setIsReady(false);
            setIsPasswordChecked(false);
        }
    }, [pdfBuffer]);

    // Validate PDF buffer
    useEffect(() => {
        if (!pdfBuffer) {
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

        // PDF is valid
        setIsReady(true);
    }, [pdfBuffer]);

    // Passed straight to <Viewer engine={engine} plugins={plugins}>.
    const engine = createEngine;
    const plugins = useMemo(() => (pdfBuffer && isReady ? viewerPlugins : []), [pdfBuffer, isReady]);

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