"use client";

import {
  Box,
  IconButton,
} from "@mui/material";
import {
  ZoomIn,
  ZoomOut,
  FitScreen,
  ZoomOutMap,
} from "@mui/icons-material";

export default function ZoomControls({ pdfViewerRef }) {
  return (
    <Box sx={{ display: "flex", gap: 0.5 }}>
      <IconButton
        size="small"
        onClick={() => pdfViewerRef.current?.zoom.zoomOut()}
        title="Zoom Out"
        sx={{ border: 1, borderColor: "divider" }}
      >
        <ZoomOut />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => pdfViewerRef.current?.zoom.zoomIn()}
        title="Zoom In"
        sx={{ border: 1, borderColor: "divider" }}
      >
        <ZoomIn />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => pdfViewerRef.current?.zoom.fitToPage()}
        title="Fit to Page"
        sx={{ border: 1, borderColor: "divider" }}
      >
        <FitScreen />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => pdfViewerRef.current?.zoom.fitToWidth()}
        title="Fit to Width"
        sx={{ border: 1, borderColor: "divider" }}
      >
        <ZoomOutMap />
      </IconButton>
    </Box>
  );
}