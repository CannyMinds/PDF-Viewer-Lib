import React from "react";
import { useDocumentState } from "@embedpdf/core/react";

/**
 * A box drawn over a page, e.g. where a metadata value was read from.
 * `page` is 1-based; `box` is [left, top, right, bottom] as fractions (0..1) of the page.
 */
export interface PDFHighlight {
  page: number;
  box: [number, number, number, number];
  label?: string;
}

const PAD = 0.004;

/**
 * Highlights for one page. Rendered inside <Rotate>, so it is laid out in unrotated page space
 * and follows zoom and rotation like the other layers. Never takes pointer events.
 */
export function HighlightLayer({
  documentId,
  pageIndex,
  scale,
  highlights,
}: {
  documentId: string;
  pageIndex: number;
  scale: number;
  highlights: PDFHighlight[];
}) {
  const documentState = useDocumentState(documentId);
  const size = documentState?.document?.pages?.[pageIndex]?.size;
  const mine = highlights.filter((h) => h.page === pageIndex + 1);
  if (!size || !mine.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: size.width * scale,
        height: size.height * scale,
        pointerEvents: "none",
      }}
    >
      {mine.map((h, i) => {
        const [x0, y0, x1, y1] = h.box;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(x0 - PAD) * 100}%`,
              top: `${(y0 - PAD) * 100}%`,
              width: `${(x1 - x0 + 2 * PAD) * 100}%`,
              height: `${(y1 - y0 + 2 * PAD) * 100}%`,
              background: "rgba(255, 213, 0, 0.32)",
              outline: "2px solid rgba(230, 160, 0, 0.95)",
              borderRadius: 2,
            }}
          >
            {h.label ? (
              <span
                style={{
                  position: "absolute",
                  left: -2,
                  bottom: "100%",
                  marginBottom: 3,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: "rgba(230, 160, 0, 0.95)",
                  color: "#1a1a1a",
                  font: "600 11px/16px system-ui, sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                {h.label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
