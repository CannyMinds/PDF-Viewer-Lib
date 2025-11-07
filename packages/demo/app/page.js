"use client";

import { PDFViewer } from "../../pdf-viewer/lib";
import { Container, Box } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import SearchComponent from "../components/SearchComponent";
import AnnotationToolbar from "../components/AnnotationToolbar";
import PDFHeader from "../components/PDFHeader";
import PDFControlsBar from "../components/PDFControlsBar";
import PasswordDialog from "../components/PasswordDialog";
import WorkerDemo from "@/components/WorkerDemo";

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
    if (!pdfBuffer) return;

    const updateInfo = () => {
      if (pdfViewerRef.current?.document) {
        const info = pdfViewerRef.current.document.getDocumentInfo();
        setDocumentInfo((prevInfo) => {
          // Only update if values actually changed
          if (
            !prevInfo ||
            prevInfo.currentPage !== info.currentPage ||
            prevInfo.totalPages !== info.totalPages
          ) {
            return info;
          }
          return prevInfo;
        });
      }
    };

    updateInfo();
    const interval = setInterval(updateInfo, 100);

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

  const handleDownload = () => {
    // Handle download functionality
  };

  return (
    <>
      <PDFHeader
        selectedFile={selectedFile}
        onFileChange={handleFileChange}
        onClear={handleClear}
      />
      {/* <Container maxWidth="lg" sx={{ mt: 2, mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: "85vh",
          }}
        >
          {pdfBuffer && (
            <PDFControlsBar
              documentInfo={documentInfo}
              pdfViewerRef={pdfViewerRef}
              onDownload={handleDownload}
            />
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
              <>
                <SearchComponent viewerRef={pdfViewerRef} />
                <AnnotationToolbar viewerRef={pdfViewerRef} />
              </>
            )}
            <div style={{ height: pdfBuffer ? "calc(100% - 180px)" : "100%" }}>
              <PDFViewer
                ref={pdfViewerRef}
                pdfBuffer={pdfBuffer}
                onPasswordRequest={handlePasswordRequest}
              />
            </div>
          </Box>
        </Box>
      </Container>*/}

      <PasswordDialog
        open={showPasswordDialog}
        passwordInput={passwordInput}
        onPasswordChange={(e) => setPasswordInput(e.target.value)}
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
      />
      <WorkerDemo />
    </>
  );
}
