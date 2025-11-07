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
import { PictureAsPdf, CloudUpload, Clear, NavigateBefore, NavigateNext, FirstPage, LastPage, ZoomIn, ZoomOut, FitScreen, ZoomOutMap } from "@mui/icons-material";
import { useState, useEffect, useRef } from "react";
import SearchComponent from "../components/SearchComponent";

export default function Page() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordResolver, setPasswordResolver] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const pdfViewerRef = useRef(null);

  // Update document info periodically
  useEffect(() => {
    if (!pdfBuffer || !pdfViewerRef.current) return;

    const updateInfo = () => {
      if (pdfViewerRef.current?.document) {
        const info = pdfViewerRef.current.document.getDocumentInfo();
        setDocumentInfo(info);
      }
    };

    // Update immediately and then more frequently for real-time updates
    updateInfo();
    const interval = setInterval(updateInfo, 100); // More frequent updates

    return () => clearInterval(interval);
  }, [pdfBuffer]);

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

          {/* Enhanced Navigation & Zoom Controls */}
          {pdfBuffer && (
            <Box
              sx={{
                display: "flex",
                gap: 1,
                mb: 1,
                justifyContent: "center",
                flexWrap: "wrap",
                alignItems: "center"
              }}
            >
              {/* Current Page Info */}
              {documentInfo && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 2,
                    py: 1,
                    backgroundColor: "primary.main",
                    color: "white",
                    borderRadius: 1,
                    fontWeight: "bold"
                  }}
                >
                  Page {documentInfo.currentPage} of {documentInfo.totalPages}
                </Box>
              )}
              {/* Navigation Controls */}
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={() => pdfViewerRef.current?.navigation.goToFirstPage()}
                  title="First Page"
                  sx={{ border: 1, borderColor: "divider" }}
                >
                  <FirstPage />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => pdfViewerRef.current?.navigation.previousPage()}
                  title="Previous Page"
                  sx={{ border: 1, borderColor: "divider" }}
                >
                  <NavigateBefore />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => pdfViewerRef.current?.navigation.nextPage()}
                  title="Next Page"
                  sx={{ border: 1, borderColor: "divider" }}
                >
                  <NavigateNext />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => pdfViewerRef.current?.navigation.goToLastPage()}
                  title="Last Page"
                  sx={{ border: 1, borderColor: "divider" }}
                >
                  <LastPage />
                </IconButton>
              </Box>

              {/* Zoom Controls */}
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

              {/* Page Jump */}
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    const page = prompt("Go to page:", documentInfo?.currentPage || 1);
                    if (page && !isNaN(page)) {
                      pdfViewerRef.current?.navigation.goToPage(parseInt(page));
                    }
                  }}
                >
                  Go to Page
                </Button>
              </Box>
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
            <div style={{ height: pdfBuffer ? 'calc(100% - 120px)' : '100%' }}>
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
