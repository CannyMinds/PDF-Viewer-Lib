import { usePDFViewer } from "./usePDFViewer";
import { EmbedPDF } from "@embedpdf/core/react";
// import { FilePicker } from "@embedpdf/plugin-loader/react";
import { Viewport } from "@embedpdf/plugin-viewport/react";
import { Scroller } from "@embedpdf/plugin-scroll/react";
import { RenderLayer } from "@embedpdf/plugin-render/react";
import { SelectionLayer } from "@embedpdf/plugin-selection/react";
import { PagePointerProvider } from "@embedpdf/plugin-interaction-manager/react";

import { useEffect, type ReactElement } from 'react';
import isPasswordProtected from "./utils/isPasswordProtected";

interface PDFViewerProps {
    pdfBuffer?: ArrayBuffer | null | undefined;
    onPasswordRequest?: (fileName?: string) => Promise<string | null>;
}

function PDFViewer({ pdfBuffer, onPasswordRequest }: PDFViewerProps): ReactElement | null {
    const { engine, plugins, isReady, instance, isLoading } = usePDFViewer({
        pdfBuffer,
    });


    useEffect(() => {
        console.log('[PDF Viewer] isLoading: ', isLoading);

    }, [isLoading]);

    useEffect(() => {
        if (pdfBuffer && isPasswordProtected(pdfBuffer)) {
            async function requestPassword() {
                let password: string | null = null;
                if (onPasswordRequest) {
                    password = await onPasswordRequest();
                }
                if (password) {
                    instance.setPassword(password);
                    instance.setIsPasswordChecked(true);
                }
            }

            if (onPasswordRequest) {
                requestPassword();
            }

        } else {
            instance.setIsPasswordChecked(true);
        }
    }, [pdfBuffer]);

    if (!isReady) {
        return null;
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
                                renderPage={({ pageIndex, scale, width, height, document, rotation }) => (
                                    <div
                                        key={document?.id}
                                        style={{
                                            width,
                                            height,
                                            position: "relative",
                                            backgroundColor: "white",
                                            userSelect: "none",
                                            WebkitUserSelect: "none",
                                        }}
                                        draggable={false}
                                    >
                                        <PagePointerProvider pageIndex={pageIndex} pageWidth={width} pageHeight={height} rotation={rotation || 0} scale={scale}>
                                            <RenderLayer pageIndex={pageIndex} scale={scale} style={{ pointerEvents: 'none' }} />
                                            <SelectionLayer pageIndex={pageIndex} scale={scale} />
                                        </PagePointerProvider>
                                    </div>
                                )}
                            />
                        )}
                    </Viewport>
                    {/* <FilePicker /> */}
                </>
            )}
        </EmbedPDF>
    );
}

export default PDFViewer;