import { EmbedPDF } from "@embedpdf/core/react";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import { createPluginRegistration } from '@embedpdf/core';
import { LoaderPluginPackage } from "@embedpdf/plugin-loader";
import { ViewportPluginPackage } from "@embedpdf/plugin-viewport";
import { ScrollPluginPackage, ScrollStrategy } from "@embedpdf/plugin-scroll";
import { RenderPluginPackage } from "@embedpdf/plugin-render";
import { useMemo } from 'react';

import { FilePicker } from "@embedpdf/plugin-loader/react";
import { Viewport } from "@embedpdf/plugin-viewport/react";
import { Scroller } from "@embedpdf/plugin-scroll/react";
import { RenderLayer } from "@embedpdf/plugin-render/react";

interface PDFViewerProps {
    pdfBuffer?: ArrayBuffer | null;
}

function PDFViewer({ pdfBuffer }: PDFViewerProps) {
    const plugins = useMemo(() => [
        createPluginRegistration(LoaderPluginPackage, {
            loadingOptions: {
                type: "buffer",
                pdfFile: {
                    id: new Date().getTime().toString(),
                    content: pdfBuffer || null,
                },
                options: {
                    password: "",
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
    ], [pdfBuffer]);
    const { engine, isLoading, error } = usePdfiumEngine();

    if (error) {
        return (
            <div>
                Failed to initialize PDF viewer: {error.message}
            </div>
        );
    }

    if (isLoading || !engine) {
        return 'Loading...';
    }

    if (!pdfBuffer) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
                fontSize: '16px'
            }}>
                No PDF file loaded
            </div>
        );
    }

    return (
        <EmbedPDF engine={engine} plugins={plugins}>
            {({ pluginsReady }) => (
                <>
                    <Viewport
                        style={{
                            width: "100%",
                            height: "100%",
                            flexGrow: 1,
                            backgroundColor: "#f1f3f5",
                            overflow: "auto",
                        }}
                    >
                        {pluginsReady && (
                            <Scroller
                                renderPage={({ pageIndex, scale, width, height, document }) => (
                                    <div
                                        key={document?.id}
                                        style={{
                                            width,
                                            height,
                                            position: "relative",
                                            backgroundColor: "white",
                                        }}
                                    >
                                        <RenderLayer pageIndex={pageIndex} />
                                    </div>
                                )}
                            />
                        )}
                    </Viewport>
                    <FilePicker />
                </>
            )}
        </EmbedPDF>
    );
}

export default PDFViewer;