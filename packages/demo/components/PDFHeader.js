"use client";

import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
} from "@mui/material";
import {
  PictureAsPdf,
  Clear,
} from "@mui/icons-material";

export default function PDFHeader({ selectedFile, onFileChange, onClear }) {
  return (
    <AppBar position="static" sx={{ minHeight: "48px" }}>
      <Toolbar variant="dense" sx={{ minHeight: "48px !important", py: 0.5 }}>
        <PictureAsPdf sx={{ mr: 1, fontSize: "1.2rem" }} />
        <Typography
          variant="subtitle1"
          sx={{ flexGrow: 1, fontSize: "1rem" }}
        >
          CM PDF Viewer
        </Typography>
        <input
          id="pdf-file-input"
          type="file"
          accept=".pdf,application/pdf"
          onChange={onFileChange}
          style={{
            display: "block",
            width: "180px",
            fontSize: "12px",
            padding: "4px 6px",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "4px",
            backgroundColor: "rgba(255,255,255,0.1)",
            color: "white",
            marginRight: "8px",
          }}
        />
        {selectedFile && (
          <IconButton
            size="small"
            onClick={onClear}
            sx={{
              color: "inherit",
              backgroundColor: "rgba(244, 67, 54, 0.8)",
              "&:hover": {
                backgroundColor: "rgba(244, 67, 54, 1)",
              },
            }}
            title="Clear PDF"
          >
            <Clear fontSize="small" />
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  );
}