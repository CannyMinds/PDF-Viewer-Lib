import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePdfiumEngine } from "@embedpdf/engines/react";
import { createPluginRegistration } from '@embedpdf/core';
import { LoaderPluginPackage } from "@embedpdf/plugin-loader";
import { ViewportPluginPackage } from "@embedpdf/plugin-viewport";
import { ScrollPluginPackage, ScrollStrategy } from "@embedpdf/plugin-scroll";
import { RenderPluginPackage } from "@embedpdf/plugin-render";
import isPasswordProtected from "./utils/isPasswordProtected";
import { validatePDFBuffer } from "./utils/validatePDFBuffer";
import { PDFError, PDFErrorType, createPDFError } from "./utils/errorTypes";

interface PDFViewerOptions {
    pdfBuffer?: ArrayBuffer | null;
    password?: string;
}

interface PDFViewerInstance {
    setPassword: (password: string) => void;
    setZoom: (scale: number) => void;
    getCurrentPage: () => number | null;
    setPage: (page: number) => void;
    getTotalPages: () => number | null;
    setPasswordChecked: (checked: boolean) => void;
}

export function usePDFViewer({ pdfBuffer, password: initialPassword }: PDFViewerOptions) {
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
        console.log('[PDF Engine Error]: ', engineError);

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
            createPluginRegistration(RenderPluginPackage),
        ];
    }, [pdfBuffer, password, isReady]);

    const instance: PDFViewerInstance = useMemo(() => ({
        setPassword: (newPassword: string) => {
            setPassword(newPassword);
        },
        setIsPasswordChecked: (checked: boolean) => {
            setIsPasswordChecked(checked);
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