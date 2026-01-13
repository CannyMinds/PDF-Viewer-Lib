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
  Paper,
} from "@mui/material";
import { PictureAsPdf, Clear, Highlight, Draw, Delete } from "@mui/icons-material";
import ApprovalIcon from '@mui/icons-material/Approval';
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import SearchComponent from "../components/SearchComponent";
import SignatureDialog from "../components/SignatureDialog";
import StampDialog from "../components/StampDialog";

export default function Page() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordResolver, setPasswordResolver] = useState(null);
  const [isHighlighterActive, setIsHighlighterActive] = useState(false);
  const [isStampActive, setIsStampActive] = useState(false);
  const [isSignatureActive, setIsSignatureActive] = useState(false);
  const [hasSelectedAnnotation, setHasSelectedAnnotation] = useState(false);
  const [annotationDetails, setAnnotationDetails] = useState(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showStampDialog, setShowStampDialog] = useState(false);
  const [allAnnotations, setAllAnnotations] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'signature', 'highlight', 'text'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showAnnotationList, setShowAnnotationList] = useState(true);
  const [currentUser, setCurrentUser] = useState({ author: "Demo User", email: "demo@example.com", id: "user123" });
  const pdfViewerRef = useRef(null);
  const lastSelectedIdRef = useRef(null);

  // Debug: Log signature active state changes
  useEffect(() => {
    console.log('🔄 isSignatureActive changed to:', isSignatureActive);
  }, [isSignatureActive]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      const buffer = await file.arrayBuffer();
      setPdfBuffer(new Uint8Array(buffer));
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPdfBuffer(null);
    setPasswordInput("");
    setAllAnnotations([]);
    setAnnotationDetails(null);
    // Clear stored annotations
    annotationsFromEvents.current = [];
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

  const handleSignatureSave = async (signatureDataUrl) => {
    setShowSignatureDialog(false);
    console.log('🖊️ Signature saved, activating stamp tool...');
    if (isHighlighterActive) {
      pdfViewerRef.current.annotation.deactivateHighlighter();
      setIsHighlighterActive(false);
    }
    if (isStampActive) {
      setIsStampActive(false);
    }
    await pdfViewerRef.current?.annotation.activateStamp(signatureDataUrl);
    setIsSignatureActive(true);
    console.log('🖊️ Signature active state set to:', true);
    console.log('🖊️ Stamp tool activated - click on PDF to place signature');
  };

  const toggleHighlighter = () => {
    if (pdfViewerRef.current) {
      if (isHighlighterActive) {
        pdfViewerRef.current.annotation.deactivateHighlighter();
        setIsHighlighterActive(false);
      } else {
        if (isStampActive) {
          pdfViewerRef.current.annotation.deactivateStamp();
          setIsStampActive(false);
        }
        if (isSignatureActive) {
          pdfViewerRef.current.annotation.deactivateStamp();
          setIsSignatureActive(false);
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
        if (isSignatureActive) {
          pdfViewerRef.current.annotation.deactivateStamp();
          setIsSignatureActive(false);
        }
        setShowStampDialog(true);
      }
    }
  };

  const handleStampSave = async (imageDataUrl, isSvg = false) => {
    setShowStampDialog(false);
    if (isHighlighterActive) {
      pdfViewerRef.current.annotation.deactivateHighlighter();
      setIsHighlighterActive(false);
    }
    if (isSignatureActive) {
      setIsSignatureActive(false);
    }
    await pdfViewerRef.current?.annotation.activateStamp(imageDataUrl);
    setIsStampActive(true);
  };

  const handleDeleteAnnotation = useCallback(() => {
    const api = pdfViewerRef.current?.annotation;
    if (!api) {
      // Annotation API not ready yet — don't throw an error, just warn and no-op.
      console.warn('Annotation API not available yet — delete ignored');
      return false;
    }

    try {
      const deleted = api.deleteSelectedAnnotation();
      if (deleted) {
        setHasSelectedAnnotation(false);
        setAnnotationDetails(null);
      }
      return deleted;
    } catch (err) {
      console.error('Error deleting annotation:', err);
      return false;
    }
  }, []);

  // Fetch all annotations from EmbedPDF
  

  // Check selection state and fetch all annotations
  useEffect(() => {
    if (!pdfBuffer) return;

    const checkInterval = setInterval(() => {
      if (pdfViewerRef.current) {
        const selected = pdfViewerRef.current.annotation.getSelectedAnnotation();
        setHasSelectedAnnotation(!!selected);

        if (selected) {
          const detail = selected.object || selected;
          // Only log when selection changes
          if (detail.id !== lastSelectedIdRef.current) {
            console.log('🎯 Raw selected annotation:', selected);
            console.log('🎯 Selected annotation detail:', detail);
            console.log('🎯 Selected annotation JSON:', JSON.stringify(detail, null, 2));
            lastSelectedIdRef.current = detail.id;
          }
          setAnnotationDetails(detail);
        } else {
          if (lastSelectedIdRef.current !== null) {
            lastSelectedIdRef.current = null;
          }
          setAnnotationDetails(null);
        }
      }
    }, 200);

    return () => clearInterval(checkInterval);
  }, [pdfBuffer]);

  // Store annotations from events
  const annotationsFromEvents = useRef([]);

  // Helper function to deduplicate annotations by ID
  const deduplicateAnnotations = (annotations) => {
    const seen = new Set();
    return annotations.filter(ann => {
      if (seen.has(ann.id)) {
        return false;
      }
      seen.add(ann.id);
      return true;
    });
  };

  // Listen to annotation events
  useEffect(() => {
    if (!pdfBuffer || !pdfViewerRef.current?.annotation) return;

    const unsubscribe = pdfViewerRef.current.annotation.onAnnotationEvent((event) => {
      // Only log create, delete, and update events to avoid console spam
      if (event.type === 'create' || event.type === 'delete' || event.type === 'update') {
        console.log(`🔔 Annotation ${event.type}:`, event.annotation?.id?.substring(0, 8));
      }

      if (event.annotation) {
        // Store annotation from event - prevent duplicates
        if (event.type === 'create') {
          // Check if annotation already exists
          const exists = annotationsFromEvents.current.some(a => a.id === event.annotation.id);
          if (!exists) {
            annotationsFromEvents.current.push(event.annotation);
            console.log('✅ Added annotation. Total:', annotationsFromEvents.current.length);
            setAllAnnotations([...annotationsFromEvents.current]);
          }
          // When stamp/signature is placed, deactivate the active state
          if (event.annotation.type === 13) {
            setIsStampActive(false);
            setIsSignatureActive(false);
          }
        } else if (event.type === 'delete') {
          annotationsFromEvents.current = annotationsFromEvents.current.filter(a => a.id !== event.annotation.id);
          console.log('🗑️ Removed annotation. Total:', annotationsFromEvents.current.length);
          setAllAnnotations([...annotationsFromEvents.current]);
        } else if (event.type === 'update') {
          const index = annotationsFromEvents.current.findIndex(a => a.id === event.annotation.id);
          if (index >= 0) {
            annotationsFromEvents.current[index] = event.annotation;
            setAllAnnotations([...annotationsFromEvents.current]);
          } else {
            // If annotation doesn't exist, add it (handles case where update comes before create)
            annotationsFromEvents.current.push(event.annotation);
            console.log('➕ Added annotation from update. Total:', annotationsFromEvents.current.length);
            setAllAnnotations([...annotationsFromEvents.current]);
          }
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
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
  }, [hasSelectedAnnotation, handleDeleteAnnotation]);

  const annotationSelectionMenu = useMemo(() => {
    return ({ menuWrapperProps = {}, selected, rect, annotation }) => {
      if (!selected || !pdfViewerRef.current?.annotation) {
        return null;
      }

      const { style: wrapperStyle = {}, ref: menuRef, className, ...restProps } = menuWrapperProps;
      
      // Get annotation rect to calculate button position
      const selectedAnnotation = pdfViewerRef.current.annotation.getSelectedAnnotation();
      const annotationRect = selectedAnnotation?.object?.rect || rect;
      const annotationWidth = annotationRect?.size?.width || annotationRect?.width || 0;
      const annotationHeight = annotationRect?.size?.height || annotationRect?.height || 0;
      
      // Calculate position: center horizontally, below annotation
      const leftOffset = annotationWidth / 2;
      const topOffset = annotationHeight + 8;
      
      return (
        <div
          ref={menuRef}
          className={className}
          {...restProps}
          style={{
            ...wrapperStyle,
            transform: `translate(calc(-50% + ${leftOffset}px), ${topOffset}px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
            padding: '5px 8px',
            pointerEvents: 'auto',
            zIndex: 99,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            width: 'auto',
            height: 'auto',
            gap: '4px',
            backgroundClip: 'padding-box',
          }}
        >
          <IconButton
            size="small"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleDeleteAnnotation();
            }}
            title="Delete annotation (Del)"
            sx={{
              color: '#d32f2f',
              padding: '2px',
              width: 'auto',
              height: 'auto',
              minWidth: 'auto',
              minHeight: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              '&:hover': {
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                color: '#c62828',
              },
              '&:active': {
                transform: 'scale(0.94)',
              },
            }}
          >
            <Delete sx={{ fontSize: '18px' }} />
          </IconButton>
        </div>
      );
    };
  }, [handleDeleteAnnotation]);

  // Filter annotations by type
  const getFilteredAnnotations = useCallback(() => {
    const annotations = allAnnotations;

    if (filterType === 'all') return annotations;
    if (filterType === 'signature') return annotations.filter(a => a.type === 13 || a.subject === 'Stamp');
    if (filterType === 'highlight') return annotations.filter(a => a.type === 8);
    if (filterType === 'text') return annotations.filter(a => a.type === 3 || a.type === 1);

    return annotations;
  }, [allAnnotations, filterType]);

  // Get paginated annotations
  const getPaginatedAnnotations = useCallback(() => {
    const filtered = getFilteredAnnotations();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [getFilteredAnnotations, currentPage, itemsPerPage]);

  // Calculate total pages
  const totalPages = Math.ceil(getFilteredAnnotations().length / itemsPerPage);

  // Export annotations as JSON file
  const exportAnnotationsJSON = () => {
    const data = {
      documentName: selectedFile?.name || 'document.pdf',
      totalAnnotations: allAnnotations.length,
      exportedAt: new Date().toISOString(),
      annotations: allAnnotations.map(ann => ({
        id: ann.id,
        type: ann.type,
        subject: ann.subject,
        pageIndex: ann.pageIndex,
        position: ann.rect,
        author: ann.author,
        created: ann.created,
        fullData: ann
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations_${selectedFile?.name || 'document'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export annotations as CSV
  const exportAnnotationsCSV = () => {
    const headers = ['ID', 'Type', 'Subject', 'Page', 'X', 'Y', 'Width', 'Height', 'Author', 'Created'];
    const rows = allAnnotations.map(ann => [
      ann.id,
      ann.type,
      ann.subject || 'N/A',
      ann.pageIndex + 1,
      ann.rect?.origin?.x?.toFixed(2) || 'N/A',
      ann.rect?.origin?.y?.toFixed(2) || 'N/A',
      ann.rect?.size?.width?.toFixed(2) || 'N/A',
      ann.rect?.size?.height?.toFixed(2) || 'N/A',
      ann.author || 'N/A',
      ann.created ? new Date(ann.created).toLocaleString() : 'N/A'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations_${selectedFile?.name || 'document'}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Log to console function
  const logAnnotationsToConsole = () => {
    const data = allAnnotations;
    console.log('='.repeat(80));
    console.log('📤 ALL ANNOTATIONS DATA');
    console.log('='.repeat(80));
    console.log('Total:', data.length);
    console.log('\n📊 By Type:');
    console.log('  Signatures/Stamps (type 13):', data.filter(a => a.type === 13).length);
    console.log('  Highlights (type 8):', data.filter(a => a.type === 8).length);
    console.log('  Text/Notes:', data.filter(a => a.type === 3 || a.type === 1).length);
    console.log('  Others:', data.filter(a => a.type !== 13 && a.type !== 8 && a.type !== 3 && a.type !== 1).length);

    data.forEach((ann, idx) => {
      console.log(`\n📝 Annotation ${idx + 1}:`);
      console.log(JSON.stringify(ann, null, 2));
    });
    console.log('\n' + '='.repeat(80));
    console.log('📦 Complete array:');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(80));
    alert(`${data.length} annotations logged to console.\n\nBreakdown:\n- Signatures: ${data.filter(a => a.type === 13).length}\n- Highlights: ${data.filter(a => a.type === 8).length}\n- Text: ${data.filter(a => a.type === 3 || a.type === 1).length}\n\nCheck Developer Tools (F12)`);
  };

  return (
    <>
      <AppBar position="static" sx={{ minHeight: "48px" }}>
        <Toolbar variant="dense" sx={{ minHeight: "48px !important", py: 0.5 }}>
          <PictureAsPdf sx={{ mr: 1, fontSize: "1.2rem" }} />
          <Typography variant="subtitle1" sx={{ flexGrow: 1, fontSize: "1rem" }}>
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
                "&:hover": { backgroundColor: "rgba(244, 67, 54, 1)" },
              }}
              title="Clear PDF"
            >
              <Clear fontSize="small" />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "85vh" }}>
          
          {/* Zoom Controls */}
          {pdfBuffer && (
            <Box sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "center" }}>
              <Button variant="outlined" size="small" onClick={() => pdfViewerRef.current?.zoom.zoomOut()}>
                Zoom Out
              </Button>
              <Button variant="outlined" size="small" onClick={() => pdfViewerRef.current?.zoom.resetZoom()}>
                100%
              </Button>
              <Button variant="outlined" size="small" onClick={() => pdfViewerRef.current?.zoom.zoomIn()}>
                Zoom In
              </Button>
            </Box>
          )}

          {/* Rotate Controls */}
          {pdfBuffer && (
            <Box sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "center" }}>
              <Button variant="outlined" size="small" onClick={() => pdfViewerRef.current?.rotate.rotateBackward()}>
                Rotate Left
              </Button>
              <Button variant="outlined" size="small" onClick={() => pdfViewerRef.current?.rotate.setRotation(0)}>
                Reset
              </Button>
              <Button variant="outlined" size="small" onClick={() => pdfViewerRef.current?.rotate.rotateForward()}>
                Rotate Right
              </Button>
            </Box>
          )}

          {/* Annotation Controls */}
          {pdfBuffer && (
            <Box sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "center" }}>
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
                startIcon={<ApprovalIcon />}
              >
                {isStampActive ? "Stamp Active" : "Add Stamp"}
              </Button>
              <Button
                variant={isSignatureActive ? "contained" : "outlined"}
                size="small"
                startIcon={<Draw />}
                onClick={() => setShowSignatureDialog(true)}
              >
                {isSignatureActive ? "Signature Active" : "Add Signature"}
              </Button>
            </Box>
          )}

          {/* Selected Annotation Details */}
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
                {annotationDetails.rect && annotationDetails.rect.origin && annotationDetails.rect.size && (
                  <div>
                    <strong>Position:</strong>{' '}
                    x={annotationDetails.rect.origin.x.toFixed(2)},{' '}
                    y={annotationDetails.rect.origin.y.toFixed(2)},{' '}
                    width={annotationDetails.rect.size.width.toFixed(2)},{' '}
                    height={annotationDetails.rect.size.height.toFixed(2)}
                  </div>
                )}
                {annotationDetails.author && <div><strong>Author:</strong> {annotationDetails.author}</div>}
                {annotationDetails.subject && <div><strong>Subject:</strong> {annotationDetails.subject}</div>}
                {annotationDetails.icon && <div><strong>Icon:</strong> {annotationDetails.icon}</div>}
                {annotationDetails.created && <div><strong>Created:</strong> {new Date(annotationDetails.created).toLocaleString()}</div>}
                <details style={{ marginTop: '8px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>All Properties (JSON)</summary>
                  <pre style={{ fontSize: '0.75rem', maxHeight: '150px', overflow: 'auto', marginTop: '4px' }}>
                    {JSON.stringify(annotationDetails, null, 2)}
                  </pre>
                </details>
              </Box>
            </Box>
          )}

          {/* All Annotations List with Filters and Pagination */}
          {allAnnotations.length > 0 && (
            <Box sx={{ mb: 1, border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
              {/* Header with Toggle */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                  📋 All Annotations ({allAnnotations.length})
                </Typography>
                <Button size="small" onClick={() => setShowAnnotationList(!showAnnotationList)}>
                  {showAnnotationList ? 'Hide' : 'Show'} List
                </Button>
              </Box>

              {showAnnotationList && (
                <>
                  {/* Filter and Export Controls */}
                  <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
                    {/* Filter Buttons */}
                    <Button
                      size="small"
                      variant={filterType === 'all' ? 'contained' : 'outlined'}
                      onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                    >
                      All ({allAnnotations.length})
                    </Button>
                    <Button
                      size="small"
                      variant={filterType === 'signature' ? 'contained' : 'outlined'}
                      onClick={() => { setFilterType('signature'); setCurrentPage(1); }}
                    >
                      Signatures ({allAnnotations.filter(a => a.type === 13).length})
                    </Button>
                    <Button
                      size="small"
                      variant={filterType === 'highlight' ? 'contained' : 'outlined'}
                      onClick={() => { setFilterType('highlight'); setCurrentPage(1); }}
                    >
                      Highlights ({allAnnotations.filter(a => a.type === 8).length})
                    </Button>
                    <Button
                      size="small"
                      variant={filterType === 'text' ? 'contained' : 'outlined'}
                      onClick={() => { setFilterType('text'); setCurrentPage(1); }}
                    >
                      Text ({allAnnotations.filter(a => a.type === 3 || a.type === 1).length})
                    </Button>

                    <Box sx={{ flexGrow: 1 }} />

                    {/* Export Buttons */}
                    <Button size="small" variant="outlined" onClick={exportAnnotationsJSON}>
                      Export JSON
                    </Button>
                    <Button size="small" variant="outlined" onClick={exportAnnotationsCSV}>
                      Export CSV
                    </Button>
                    <Button size="small" variant="outlined" onClick={logAnnotationsToConsole}>
                      Log Console
                    </Button>
                  </Box>

                  {/* Annotations List */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: "300px", overflow: "auto", mb: 2 }}>
                    {getPaginatedAnnotations().map((ann, idx) => {
                      const rect = ann.rect;
                      let position = 'N/A';
                      if (rect?.origin && rect?.size) {
                        position = `x=${rect.origin.x.toFixed(2)}, y=${rect.origin.y.toFixed(2)}, w=${rect.size.width.toFixed(2)}, h=${rect.size.height.toFixed(2)}`;
                      }

                      // Determine annotation type label
                      let typeLabel = 'Unknown';
                      if (ann.type === 13) typeLabel = '📝 Signature/Stamp';
                      else if (ann.type === 8) typeLabel = '🖍️ Highlight';
                      else if (ann.type === 3 || ann.type === 1) typeLabel = '📄 Text';
                      else typeLabel = `Type ${ann.type}`;

                      // Use index as fallback for unique key
                      const uniqueKey = `${ann.id}-${idx}`;

                      return (
                        <Paper key={uniqueKey} sx={{ p: 1.5, '&:hover': { backgroundColor: 'action.hover' } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {typeLabel} {ann.subject && `• ${ann.subject}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Page {ann.pageIndex + 1} • ID: {ann.id.substring(0, 8)}... • {position}
                              </Typography>
                              {ann.created && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  🕒 {new Date(ann.created).toLocaleString()}
                                </Typography>
                              )}
                              {ann.author && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  👤 {ann.author}
                                </Typography>
                              )}
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                console.log('📋 Annotation JSON:');
                                console.log(JSON.stringify(ann, null, 2));
                                alert('JSON logged to console (F12)');
                              }}
                            >
                              View JSON
                            </Button>
                          </Box>
                        </Paper>
                      );
                    })}

                    {getPaginatedAnnotations().length === 0 && (
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          No {filterType === 'all' ? '' : filterType} annotations found
                        </Typography>
                      </Paper>
                    )}
                  </Box>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1 }}>
                      <Button
                        size="small"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(1)}
                      >
                        First
                      </Button>
                      <Button
                        size="small"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                      >
                        Previous
                      </Button>
                      <Typography variant="body2">
                        Page {currentPage} of {totalPages} ({getFilteredAnnotations().length} items)
                      </Typography>
                      <Button
                        size="small"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                      >
                        Next
                      </Button>
                      <Button
                        size="small"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        Last
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}

          <Box sx={{ width: "100%", height: "60vh", border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", position: 'relative' }}>
            {pdfBuffer && <SearchComponent viewerRef={pdfViewerRef} />}
            <div style={{ height: pdfBuffer ? 'calc(100% - 60px)' : '100%' }}>
              <PDFViewer
                ref={pdfViewerRef}
                pdfBuffer={pdfBuffer}
                onPasswordRequest={handlePasswordRequest}
                userDetails={{
                  name: currentUser.author,
                  email: currentUser.email,
                  id: currentUser.id
                }}
                annotationSelectionMenu={annotationSelectionMenu}
              />
            </div>
          </Box>
        </Box>
      </Container>

      <Dialog open={showPasswordDialog} onClose={handlePasswordCancel}>
        <DialogTitle>Password Required</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This PDF is password protected. Please enter the password to view it.
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

      <SignatureDialog
        open={showSignatureDialog}
        onClose={() => setShowSignatureDialog(false)}
        onSave={handleSignatureSave}
        username={currentUser.author}
      />

      <StampDialog
        open={showStampDialog}
        onClose={() => setShowStampDialog(false)}
        onSave={handleStampSave}
        username={currentUser.author}
      />
    </>
  );
}
