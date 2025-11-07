"use client";

import { PDFViewer } from "../../pdf-viewer/lib";
import {
  Container,
  Typography,
  Box,
  AppBar,
  Toolbar,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { PictureAsPdf, CloudUpload, Clear, Highlight, Delete, Image } from "@mui/icons-material";
import { useState, useEffect, useRef } from "react";
import SearchComponent from "../components/SearchComponent";

export default function Page() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordResolver, setPasswordResolver] = useState(null);
  const [isHighlighterActive, setIsHighlighterActive] = useState(false);
  const [isStampActive, setIsStampActive] = useState(false);
  const [hasSelectedAnnotation, setHasSelectedAnnotation] = useState(false);
  const [annotationDetails, setAnnotationDetails] = useState(null);
  const pdfViewerRef = useRef(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      const buffer = await file.arrayBuffer();
      setPdfBuffer(buffer);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPdfBuffer(null);
    setPasswordInput("");
  };

  const handlePasswordRequest = () => {
    return new Promise((resolve) => {
      setPasswordResolver(() => resolve);
      setShowPasswordDialog(true);
    });
  };

  const handlePasswordSubmit = () => {
    if (passwordResolver) {
      passwordResolver(passwordInput);
    }
    setShowPasswordDialog(false);
    setPasswordResolver(null);
    setPasswordInput("");
  };

  const handlePasswordCancel = () => {
    if (passwordResolver) {
      passwordResolver(null);
    }
    setShowPasswordDialog(false);
    setPasswordResolver(null);
    setPasswordInput("");
  };

  const toggleHighlighter = () => {
    if (pdfViewerRef.current) {
      if (isHighlighterActive) {
        pdfViewerRef.current.annotation.deactivateHighlighter();
        setIsHighlighterActive(false);
      } else {
        // Deactivate stamp if active
        if (isStampActive) {
          pdfViewerRef.current.annotation.deactivateStamp();
          setIsStampActive(false);
        }
        pdfViewerRef.current.annotation.activateHighlighter();
        setIsHighlighterActive(true);
      }
    }
  };

  const toggleStamp = () => {
    if (pdfViewerRef.current) {
      if (isStampActive) {
        pdfViewerRef.current.annotation.deactivateStamp();
        setIsStampActive(false);
      } else {
        // Deactivate highlighter if active
        if (isHighlighterActive) {
          pdfViewerRef.current.annotation.deactivateHighlighter();
          setIsHighlighterActive(false);
        }
        pdfViewerRef.current.annotation.activateStamp();
        setIsStampActive(true);
      }
    }
  };

  const handleDeleteAnnotation = () => {
    if (pdfViewerRef.current) {
      const deleted = pdfViewerRef.current.annotation.deleteSelectedAnnotation();
      if (deleted) {
        setHasSelectedAnnotation(false);
      }
    }
  };

  // Check selection state periodically and get details
  useEffect(() => {
    if (!pdfBuffer) return;

    const checkInterval = setInterval(() => {
      if (pdfViewerRef.current) {
        const selected = pdfViewerRef.current.annotation.getSelectedAnnotation();
        setHasSelectedAnnotation(!!selected);

        if (selected) {
          const details = pdfViewerRef.current.annotation.getSelectedAnnotationDetails();
          setAnnotationDetails(details);
        } else {
          setAnnotationDetails(null);
        }
      }
    }, 200);

    return () => clearInterval(checkInterval);
  }, [pdfBuffer]);

  // Handle Delete key press
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelectedAnnotation) {
        event.preventDefault();
        handleDeleteAnnotation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSelectedAnnotation]);

  // const { error, isReady, isLoading, instance } = usePDFViewer({});

  // useEffect(() => {
  //     console.log('[PDF Error]: ', error);
  // }, [error]);

  return (
    <>
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
            onChange={handleFileChange}
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
              onClick={handleClear}
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
      <Container maxWidth="lg" sx={{ mt: 2, mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: "85vh",
          }}
        >
          <Button onClick={() => console.log(pdfViewerRef.current.zoom.getZoom())}>Test Btn</Button>
          {/* Zoom Controls */}
          {pdfBuffer && (
            <Box
              sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "center" }}
            >
              <Button
                variant="outlined"
                size="small"
                onClick={() => pdfViewerRef.current?.zoom.zoomOut()}
              >
                Zoom Out
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => pdfViewerRef.current?.zoom.resetZoom()}
              >
                100%
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => pdfViewerRef.current?.zoom.zoomIn()}
              >
                Zoom In
              </Button>
            </Box>
          )}
          {/* Rotate Controls */}
          {pdfBuffer && (
            <Box
              sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "center" }}
            >
              <Button
                variant="outlined"
                size="small"
                onClick={() => pdfViewerRef.current?.rotate.rotateBackward()}
              >
                Rotate Left
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => pdfViewerRef.current?.rotate.setRotation(0)}
              >
                Reset
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => pdfViewerRef.current?.rotate.rotateForward()}
              >
                Rotate Right
              </Button>
            </Box>
          )}
          {/* Annotation Controls */}
          {pdfBuffer && (
            <Box
              sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "center" }}
            >
              <Button
                variant={isHighlighterActive ? "contained" : "outlined"}
                size="small"
                onClick={toggleHighlighter}
                startIcon={<Highlight />}
              >
                {isHighlighterActive ? "Highlighter Active" : "Activate Highlighter"}
              </Button>
              <Button
                variant={isStampActive ? "contained" : "outlined"}
                size="small"
                onClick={toggleStamp}
                startIcon={<Image />}
              >
                {isStampActive ? "Image Tool Active" : "Add Image"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleDeleteAnnotation}
                startIcon={<Delete />}
                color="error"
                disabled={!hasSelectedAnnotation}
              >
                Delete {hasSelectedAnnotation && '✓'}
              </Button>
            </Box>
          )}
          {/* Annotation Details Panel */}
          {annotationDetails && (
            <Box
              sx={{
                mb: 1,
                p: 2,
                border: 1,
                borderColor: "info.main",
                borderRadius: 1,
                backgroundColor: "info.light",
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                Selected Annotation Details:
              </Typography>
              <Box sx={{ fontSize: "0.875rem", fontFamily: "monospace", maxHeight: "200px", overflow: "auto" }}>
                <div><strong>ID:</strong> {annotationDetails.id}</div>
                <div><strong>Type:</strong> {annotationDetails.type}</div>
                <div><strong>Page:</strong> {annotationDetails.pageIndex}</div>

                {/* Position from rect */}
                {annotationDetails.rect && (
                  <div>
                    <strong>Position:</strong>{' '}
                    x={annotationDetails.rect.origin?.x?.toFixed(2) || annotationDetails.rect.x?.toFixed(2) || 'N/A'},{' '}
                    y={annotationDetails.rect.origin?.y?.toFixed(2) || annotationDetails.rect.y?.toFixed(2) || 'N/A'},{' '}
                    width={annotationDetails.rect.size?.width?.toFixed(2) || annotationDetails.rect.width?.toFixed(2) || 'N/A'},{' '}
                    height={annotationDetails.rect.size?.height?.toFixed(2) || annotationDetails.rect.height?.toFixed(2) || 'N/A'}
                  </div>
                )}
                {annotationDetails.bbox && (
                  <div>
                    <strong>BBox:</strong> {JSON.stringify(annotationDetails.bbox)}
                  </div>
                )}
                {annotationDetails.position && (
                  <div>
                    <strong>Position:</strong> {JSON.stringify(annotationDetails.position)}
                  </div>
                )}

                {annotationDetails.color && <div><strong>Color:</strong> {annotationDetails.color}</div>}
                {annotationDetails.opacity !== undefined && <div><strong>Opacity:</strong> {annotationDetails.opacity}</div>}
                {annotationDetails.author && <div><strong>Author:</strong> {annotationDetails.author}</div>}

                <details style={{ marginTop: '8px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>All Properties (JSON)</summary>
                  <pre style={{ fontSize: '0.75rem', maxHeight: '150px', overflow: 'auto', marginTop: '4px' }}>
                    {JSON.stringify(annotationDetails, null, 2)}
                  </pre>
                </details>
              </Box>
            </Box>
          )}
          <Box
            sx={{
              width: "100%",
              height: "80vh",
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            {pdfBuffer && (
              <SearchComponent viewerRef={pdfViewerRef} />
            )}
            <div style={{ height: pdfBuffer ? 'calc(100% - 60px)' : '100%' }}>
              <PDFViewer
                ref={pdfViewerRef}
                pdfBuffer={pdfBuffer}
                onPasswordRequest={handlePasswordRequest}
              />
            </div>
          </Box>
        </Box>
      </Container>

      <Dialog open={showPasswordDialog} onClose={handlePasswordCancel}>
        <DialogTitle>Password Required</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This PDF is password protected. Please enter the password to view
            it.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="PDF Password"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handlePasswordSubmit();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePasswordCancel}>Cancel</Button>
          <Button onClick={handlePasswordSubmit} variant="contained">
            Open PDF
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
