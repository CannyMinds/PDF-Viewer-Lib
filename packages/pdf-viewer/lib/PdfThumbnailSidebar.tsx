/**
 * PdfThumbnailSidebar
 *
 * A self-contained thumbnail panel built on top of @embedpdf plugins.
 * Drop it next to <PDFViewer /> and bind the currentPage / onPageClick
 * to the viewer's navigation ref.
 *
 * Features
 * - Resizable by dragging the right edge
 * - Two-page spread support (groups pages in pairs)
 * - Auto-scrolls the active thumbnail into view
 * - Zero external UI dependencies (uses plain CSS-in-JS via inline styles)
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
} from "react";
import { EmbedPDF } from "@embedpdf/core/react";
import { RenderLayer } from "@embedpdf/plugin-render/react";
import { usePDFViewer } from "./usePDFViewer";

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface PdfThumbnailSidebarProps {
  /** The raw PDF bytes to render thumbnails for (same buffer as the main viewer). */
  pdfBuffer: Uint8Array | ArrayBuffer | null;
  /** Total page count (from `pdfViewerRef.current.navigation.getTotalPages()`). */
  totalPages: number;
  /** 1-based current page (from `pdfViewerRef.current.navigation.getCurrentPage()`). */
  currentPage: number;
  /** When true, pages are grouped in 2-page spreads (mirrors the main viewer). */
  twoPageMode?: boolean;
  /** Called when the user clicks a thumbnail; pass `pageNum` to `navigation.goToPage()`. */
  onPageClick: (pageNum: number) => void;
  /** Called when the user clicks the ✕ / collapse button. */
  onClose: () => void;
  /** Accent colour used for the active-page highlight. Defaults to #2563eb */
  accentColor?: string;
  /** Maximum width the panel can be expanded to. Defaults to 450 in two-page mode and 320 in single-page mode. */
  maxWidth?: number;
}

// ---------------------------------------------------------------------------
// Tiny SVG icons (no external icon dependency required)
// ---------------------------------------------------------------------------

const ChevronLeftIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

// ---------------------------------------------------------------------------
// PdfThumbnailSidebar (outer shell – handles resize + layout)
// ---------------------------------------------------------------------------

export const PdfThumbnailSidebar: React.FC<PdfThumbnailSidebarProps> = ({
  pdfBuffer,
  totalPages,
  currentPage,
  twoPageMode = false,
  onPageClick,
  onClose,
  accentColor = "#2563eb",
  maxWidth,
}) => {
  const resolvedMaxWidth = maxWidth ?? (twoPageMode ? 450 : 320);
  const [width, setWidth] = useState(() => Math.min(twoPageMode ? 360 : 220, resolvedMaxWidth));
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  // Adjust sidebar width limits
  useEffect(() => {
    setWidth((prev) => Math.min(prev, resolvedMaxWidth));
  }, [resolvedMaxWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = widthRef.current;

    const onMove = (mv: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(resolvedMaxWidth, startWidth + mv.clientX - startX));
      setWidth(newWidth);
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const containerStyle: CSSProperties = {
    width: `${width}px`,
    minWidth: `${width}px`,
    height: "100%",
    display: "flex",
    flexDirection: "row",
    position: "relative",
    zIndex: 10,
    backgroundColor: "var(--thumbnail-bg, #ffffff)",
    userSelect: isResizing ? "none" : "auto",
    flexShrink: 0,
  };

  const panelStyle: CSSProperties = {
    flexGrow: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--thumbnail-border, #e2e8f0)",
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--thumbnail-border, #e2e8f0)",
    flexShrink: 0,
  };

  const closeBtnStyle: CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px",
    borderRadius: "4px",
    color: "#64748b",
    transition: "background 0.15s, color 0.15s",
  };

  const resizerStyle: CSSProperties = {
    width: "5px",
    cursor: "col-resize",
    flexShrink: 0,
    background: isResizing ? accentColor : "transparent",
    transition: "background 0.15s",
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 11,
  };

  return (
    <div style={containerStyle}>
      <div style={panelStyle}>
        {/* ── Header ── */}
        <div style={headerStyle}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            Pages
          </span>
          <button
            style={closeBtnStyle}
            onClick={onClose}
            title="Close thumbnail panel"
            aria-label="Close thumbnail panel"
          >
            <ChevronLeftIcon />
          </button>
        </div>

        {/* ── Content ── */}
        {!pdfBuffer ? (
          <div
            style={{
              display: "flex",
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Spinner />
          </div>
        ) : (
          <ThumbnailLoader
            pdfBuffer={pdfBuffer}
            totalPages={totalPages}
            currentPage={currentPage}
            twoPageMode={twoPageMode}
            onPageClick={onPageClick}
            accentColor={accentColor}
          />
        )}
      </div>

      {/* ── Drag handle ── */}
      <div
        style={resizerStyle}
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Internal: ThumbnailLoader
// Mounts a *separate* EmbedPDF instance with a minimal plugin set
// (DocumentManager + Render only) to render page thumbnails efficiently.
// ---------------------------------------------------------------------------

interface ThumbnailLoaderProps {
  pdfBuffer: Uint8Array | ArrayBuffer;
  totalPages: number;
  currentPage: number;
  twoPageMode: boolean;
  onPageClick: (pageNum: number) => void;
  accentColor: string;
}

const ThumbnailLoader: React.FC<ThumbnailLoaderProps> = ({
  pdfBuffer,
  totalPages,
  currentPage,
  twoPageMode,
  onPageClick,
  accentColor,
}) => {
  // Convert Uint8Array → ArrayBuffer if needed
  const buffer: ArrayBuffer =
    pdfBuffer instanceof Uint8Array ? pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    ) as ArrayBuffer : pdfBuffer;

  const { engine, plugins, isLoading, isReady, error } = usePDFViewer({
    pdfBuffer: buffer,
  });

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    const el = document.getElementById(`cm-thumb-page-${currentPage - 1}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentPage]);

  if (isLoading || !isReady) {
    return (
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: "center",
          color: "#ef4444",
          fontSize: 13,
        }}
      >
        Failed to load page previews
      </div>
    );
  }

  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {({ activeDocumentId, activeDocument }) => {
        const actualTotal =
          (activeDocument as any)?.document?.pageCount || totalPages || 0;
        const isDocLoading = (activeDocument as any)?.status === "loading";

        if (isDocLoading || !activeDocumentId) {
          return (
            <div
              style={{
                display: "flex",
                flexGrow: 1,
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Spinner />
            </div>
          );
        }

        // Build spread groups
        const spreads: number[][] = [];
        if (twoPageMode) {
          for (let i = 0; i < actualTotal; i += 2) {
            const spread: number[] = [i];
            if (i + 1 < actualTotal) spread.push(i + 1);
            spreads.push(spread);
          }
        } else {
          for (let i = 0; i < actualTotal; i++) {
            spreads.push([i]);
          }
        }

        return (
          <div
            style={{
              flexGrow: 1,
              overflowY: "auto",
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            {spreads.map((pageIndices, spreadIdx) => {
              const isSpreadActive = pageIndices.some(
                (idx) => idx + 1 === currentPage
              );

              return (
                <div
                  key={spreadIdx}
                  id={`cm-thumb-spread-${spreadIdx}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "100%",
                    gap: 6,
                    padding: "4px",
                    borderRadius: 8,
                    border: `2px solid ${
                      twoPageMode && isSpreadActive ? accentColor + "44" : "transparent"
                    }`,
                    background:
                      twoPageMode && isSpreadActive
                        ? accentColor + "11"
                        : "transparent",
                    transition: "all 0.18s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: twoPageMode ? 8 : 0,
                      width: "100%",
                    }}
                  >
                    {pageIndices.map((index) => {
                      const pageNum = index + 1;
                      const isActive = pageNum === currentPage;

                      return (
                        <ThumbnailPage
                          key={index}
                          index={index}
                          pageNum={pageNum}
                          isActive={isActive}
                          twoPageMode={twoPageMode}
                          documentId={activeDocumentId}
                          accentColor={accentColor}
                          onPageClick={onPageClick}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }}
    </EmbedPDF>
  );
};

// ---------------------------------------------------------------------------
// Individual thumbnail page cell
// ---------------------------------------------------------------------------

interface ThumbnailPageProps {
  index: number;
  pageNum: number;
  isActive: boolean;
  twoPageMode: boolean;
  documentId: string;
  accentColor: string;
  onPageClick: (pageNum: number) => void;
}

const ThumbnailPage: React.FC<ThumbnailPageProps> = ({
  index,
  pageNum,
  isActive,
  twoPageMode,
  documentId,
  accentColor,
  onPageClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const wrapperStyle: CSSProperties = {
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    width: twoPageMode ? "45%" : "100%",
    maxWidth: twoPageMode ? 150 : 200,
    transition: "transform 0.15s",
    transform: hovered || isActive ? "scale(1.03)" : "scale(1)",
  };

  const canvasWrapperStyle: CSSProperties = {
    width: "100%",
    aspectRatio: "1 / 1.414",
    border: `${isActive ? 2 : 1}px solid ${
      isActive ? accentColor : hovered ? "#94a3b8" : "#e2e8f0"
    }`,
    borderRadius: 6,
    overflow: "hidden",
    boxShadow: isActive
      ? `0 0 0 2px ${accentColor}44, 0 4px 6px -1px rgba(0,0,0,0.1)`
      : hovered
      ? "0 4px 12px rgba(0,0,0,0.1)"
      : "0 1px 3px rgba(0,0,0,0.05)",
    backgroundColor: "#fff",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: isActive ? 600 : 400,
    color: isActive ? accentColor : "#64748b",
    userSelect: "none",
    lineHeight: 1,
  };

  return (
    <div
      id={`cm-thumb-page-${index}`}
      style={wrapperStyle}
      onClick={() => onPageClick(pageNum)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`Go to page ${pageNum}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onPageClick(pageNum);
      }}
    >
      <div style={canvasWrapperStyle}>
        <RenderLayer
          documentId={documentId}
          pageIndex={index}
          scale={0.25}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
      <span style={labelStyle}>{pageNum}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tiny spinner (no dependency)
// ---------------------------------------------------------------------------

const Spinner: React.FC = () => (
  <div
    style={{
      width: 28,
      height: 28,
      border: "3px solid #e2e8f0",
      borderTopColor: "#2563eb",
      borderRadius: "50%",
      animation: "cm-spin 0.7s linear infinite",
    }}
  >
    <style>{`@keyframes cm-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
