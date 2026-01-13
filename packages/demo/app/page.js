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
  Chip,
  Alert,
  Snackbar,
} from "@mui/material";
import { PictureAsPdf, Clear, Highlight, Draw, Delete, Save, CloudUpload, Print } from "@mui/icons-material";
import ApprovalIcon from '@mui/icons-material/Approval';
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  setCurrentDocument,
  addAnnotation,
  deleteAnnotation as deleteReduxAnnotation,
  updateAnnotation as updateReduxAnnotation,
  markAsSaved,
  selectCurrentDocumentAnnotations,
  selectHasUnsavedChanges,
  selectLastSaved,
  replaceAllAnnotations,
  clearCurrentAnnotations,
} from '../store/annotationsSlice';
import SearchComponent from "../components/SearchComponent";
import SignatureDialog from "../components/SignatureDialog";
import StampDialog from "../components/StampDialog";

/**
 * Convert ImageData to data URL for storage
 * @param {ImageData} imageData - The ImageData object from canvas
 * @returns {string} Base64 data URL
 */
function imageDataToDataUrl(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Convert data URL to ImageData for EmbedPDF import
 * @param {string} dataUrl - Base64 data URL
 * @returns {Promise<ImageData>} ImageData object
 */
async function dataUrlToImageData(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      resolve(imageData);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export default function Page() {
  // Redux
  const dispatch = useDispatch();
  const savedAnnotations = useSelector(selectCurrentDocumentAnnotations);
  const hasUnsavedChanges = useSelector(selectHasUnsavedChanges);
  const lastSaved = useSelector(selectLastSaved);

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
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [annotationCount, setAnnotationCount] = useState(0);
  const pdfViewerRef = useRef(null);
  const lastSelectedIdRef = useRef(null);

  // Debug: Log signature active state changes
  useEffect(() => {
    console.log('🔄 isSignatureActive changed to:', isSignatureActive);
  }, [isSignatureActive]);

  // Debug: Log annotation count changes
  useEffect(() => {
    console.log('📈 annotationCount state changed to:', annotationCount);
  }, [annotationCount]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      console.log('📁 Loading new PDF file:', file.name);

      // Reset annotations for new file
      annotationsFromEvents.current = [];
      setAllAnnotations([]);
      setAnnotationCount(0);
      console.log('🔄 Reset annotation count to 0');

      setSelectedFile(file);
      const buffer = await file.arrayBuffer();
      setPdfBuffer(new Uint8Array(buffer));
      console.log('📄 PDF buffer set, waiting for viewer to initialize...');

      // Set current document in Redux first
      dispatch(setCurrentDocument(file.name));

      // Use a small delay to allow Redux state to update, then check and auto-load saved annotations
      setTimeout(() => {
        const persistedData = localStorage.getItem('persist:pdf-annotations');
        if (persistedData) {
          console.log('✅ localStorage data found for key: persist:pdf-annotations');
          const parsed = JSON.parse(persistedData);
          const docs = JSON.parse(parsed.documents || '{}');
          const savedForThisDoc = docs[file.name]?.annotations || [];

          console.log('💾 Saved annotations for this document:', savedForThisDoc.length);

          if (savedForThisDoc.length > 0) {
            console.log('🔄 Auto-loading saved annotations...');
            setSnackbar({
              open: true,
              message: `Found ${savedForThisDoc.length} saved annotations. Auto-loading...`,
              severity: 'info'
            });

            // Auto-load annotations after PDF is ready (1.5s delay)
            setTimeout(() => {
              handleLoadAnnotations();
            }, 1500);
          }
        } else {
          console.log('ℹ️ No localStorage data yet');
        }
      }, 100);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPdfBuffer(null);
    setPasswordInput("");
    setAllAnnotations([]);
    setAnnotationDetails(null);
    setAnnotationCount(0);
    // Clear stored annotations
    annotationsFromEvents.current = [];
  };

  // Save annotations to Redux/LocalStorage
  const handleSaveAnnotations = () => {
    if (!selectedFile) {
      setSnackbar({ open: true, message: 'No document loaded', severity: 'warning' });
      return;
    }

    const documentName = selectedFile.name;

    // Get current annotations from the viewer
    const currentAnnotations = annotationsFromEvents.current;

    console.log('💾 Save button clicked!');
    console.log('📊 annotationsFromEvents.current:', currentAnnotations.length);
    console.log('📊 annotationCount state:', annotationCount);
    console.log('📋 Annotations sample:', currentAnnotations.slice(0, 2).map(a => ({
      id: a.id?.substring(0, 8),
      type: a.type,
      pageIndex: a.pageIndex,
      hasRect: !!a.rect,
      hasImageSrc: !!a.imageSrc
    })));

    if (currentAnnotations.length === 0) {
      setSnackbar({ open: true, message: 'No annotations to save', severity: 'info' });
      return;
    }

    // Validate annotations before saving
    const invalidAnnotations = currentAnnotations.filter(ann =>
      !ann.id || typeof ann.pageIndex !== 'number' || !ann.type
    );

    if (invalidAnnotations.length > 0) {
      console.error('⚠️ Found invalid annotations:', invalidAnnotations);
      setSnackbar({
        open: true,
        message: `Found ${invalidAnnotations.length} invalid annotations. Please check console.`,
        severity: 'warning'
      });
    }

    console.log('💾 Saving annotations to localStorage:', currentAnnotations.length);
    console.log('📄 Document:', documentName);

    // Save to Redux (which automatically persists to localStorage via redux-persist)
    dispatch(replaceAllAnnotations({
      documentName,
      annotations: currentAnnotations
    }));

    // Mark as saved to update timestamp and clear unsaved changes flag
    dispatch(markAsSaved({ documentName }));

    // Verify save in localStorage
    setTimeout(() => {
      const persistedData = localStorage.getItem('persist:pdf-annotations');
      if (persistedData) {
        console.log('✅ Data persisted to localStorage successfully!');
        console.log('📦 localStorage key: persist:pdf-annotations');
        const parsed = JSON.parse(persistedData);
        console.log('📊 Persisted state:', JSON.parse(parsed.documents || '{}'));
      } else {
        console.warn('⚠️ localStorage persistence not found!');
      }
    }, 100);

    setSnackbar({
      open: true,
      message: `Saved ${currentAnnotations.length} annotations to localStorage!`,
      severity: 'success'
    });
  };

  // Clear saved annotations from Redux/LocalStorage for current document
  const handleClearSavedAnnotations = () => {
    if (!selectedFile) {
      setSnackbar({ open: true, message: 'No document loaded', severity: 'warning' });
      return;
    }

    const documentName = selectedFile.name;

    console.log('🗑️ Clearing saved annotations for:', documentName);

    // Clear from Redux
    dispatch(clearCurrentAnnotations({ documentName }));

    // Verify deletion
    setTimeout(() => {
      const persistedData = localStorage.getItem('persist:pdf-annotations');
      if (persistedData) {
        const parsed = JSON.parse(persistedData);
        const docs = JSON.parse(parsed.documents || '{}');
        console.log('📊 Remaining documents in localStorage:', Object.keys(docs));
      }
    }, 100);

    setSnackbar({
      open: true,
      message: `Cleared saved annotations for ${documentName}!`,
      severity: 'success'
    });
  };

  // Clear ALL saved annotations from localStorage (all documents)
  const handleClearAllSavedAnnotations = () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear ALL saved annotations for ALL documents?\n\nThis action cannot be undone!'
    );

    if (!confirmed) return;

    console.log('🗑️ Clearing ALL saved annotations from localStorage');

    // Clear entire localStorage key
    localStorage.removeItem('persist:pdf-annotations');

    // Also clear Redux state
    // Note: You may need to reload the page for this to take full effect
    window.location.reload();

    setSnackbar({
      open: true,
      message: 'Cleared all saved annotations from localStorage!',
      severity: 'success'
    });
  };

  // Load annotations from Redux/LocalStorage
  const handleLoadAnnotations = async () => {
    if (!selectedFile || !pdfViewerRef.current) {
      setSnackbar({ open: true, message: 'No document loaded', severity: 'warning' });
      return;
    }

    if (savedAnnotations.length === 0) {
      setSnackbar({ open: true, message: 'No saved annotations found', severity: 'info' });
      return;
    }

    try {
      console.log('📥 Loading', savedAnnotations.length, 'annotations');
      console.log('📋 Saved annotations:', JSON.stringify(savedAnnotations, null, 2));

      const annotationAPI = pdfViewerRef.current.annotation;
      if (!annotationAPI) {
        console.error('❌ Annotation API not available');
        setSnackbar({ open: true, message: 'Annotation API not ready', severity: 'error' });
        return;
      }

      // CRITICAL: Wait for the PDF viewer to be fully ready
      // The annotation plugin needs the document to be loaded and rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('✅ PDF Viewer ready, proceeding with import');

      // Convert date strings back to Date objects for EmbedPDF
      // Need async processing for stamp image conversion
      const annotationsToImport = await Promise.all(savedAnnotations.map(async (ann, idx) => {
        // Deep clone to avoid reference issues
        const annotation = JSON.parse(JSON.stringify(ann));

        // Convert created date string to Date object (required by EmbedPDF)
        if (annotation.created && typeof annotation.created === 'string') {
          annotation.created = new Date(annotation.created);
        }

        // Convert modified date string to Date object
        if (annotation.modified && typeof annotation.modified === 'string') {
          annotation.modified = new Date(annotation.modified);
        }

        // Ensure required fields
        if (!annotation.id) {
          annotation.id = `imported-${Date.now()}-${idx}`;
        }

        // Ensure pageIndex is a number
        if (typeof annotation.pageIndex !== 'number') {
          annotation.pageIndex = 0;
        }

        // For STAMP annotations (type 13), get imageSrc from custom field (v2.x pattern)
        if (annotation.type === 13) {
          const imageSrc = annotation.custom?.imageSrc;
          console.log(`🔍 [Load] STAMP #${idx}:`, {
            id: annotation.id?.substring(0, 8),
            page: annotation.pageIndex,
            hasCustomImageSrc: !!imageSrc,
            imageSrcLength: imageSrc?.length,
            rect: annotation.rect
          });

          // Ensure rect is properly formatted
          if (annotation.rect && !annotation.rect.origin) {
            // Convert from array format [x,y,x2,y2] to object format if needed
            if (Array.isArray(annotation.rect) && annotation.rect.length === 4) {
              const [x, y, x2, y2] = annotation.rect;
              annotation.rect = {
                origin: { x, y },
                size: { width: x2 - x, height: y2 - y }
              };
            }
          }
        }

        // For text markup annotations (Highlight, Underline, etc.), ensure segmentRects exists
        // EmbedPDF v2.x requires this property, otherwise AnnotationLayer crashes
        if ([8, 9, 10, 11].includes(annotation.type) && !annotation.segmentRects) {
          console.warn(`⚠️ Polyfilling missing segmentRects for import of annotation ${annotation.id?.substring(0, 8)}`);
          annotation.segmentRects = annotation.rect ? [JSON.parse(JSON.stringify(annotation.rect))] : [];
        }

        // Return in the format expected by importAnnotations API
        const item = {
          annotation,
          pageIndex: annotation.pageIndex,
        };

        // For STAMP/SIGNATURE annotations, convert the data URL to ImageData object for ctx
        // EmbedPDF v2.x requires ImageData object, NOT data URL string
        // Handle both legacy format (imageSrc at root) and new format (custom.imageSrc)
        const stampImageSrc = annotation.custom?.imageSrc || annotation.imageSrc;
        if (annotation.type === 13 && stampImageSrc) {
          try {
            console.log(`🔄 [Load] Converting imageSrc to ImageData for stamp/signature ${annotation.id?.substring(0, 8)}...`);
            const imageData = await dataUrlToImageData(stampImageSrc);
            item.ctx = { imageData };
            console.log(`✅ [Load] ImageData created: ${imageData.width}x${imageData.height}`);
          } catch (err) {
            console.error(`❌ [Load] Failed to convert imageSrc for stamp/signature:`, err);
          }
        }

        return item;
      }));

      console.log('📤 Importing', annotationsToImport.length, 'annotations');
      console.log('📋 Sample:', {
        type: annotationsToImport[0]?.annotation?.type,
        id: annotationsToImport[0]?.annotation?.id?.substring(0, 8),
        hasCtx: !!annotationsToImport[0]?.ctx,
        ctxImageDataSize: annotationsToImport[0]?.ctx?.imageData ?
          `${annotationsToImport[0].ctx.imageData.width}x${annotationsToImport[0].ctx.imageData.height}` : null,
      });

      // Import annotations
      let result;
      try {
        result = await annotationAPI.importAnnotations(annotationsToImport);
        console.log('✅ Import result:', result);

        if (result.failed > 0) {
          console.warn(`⚠️ ${result.failed} annotations failed to import`);
        }
      } catch (importError) {
        console.error('❌ Import failed with error:', importError);
        setSnackbar({
          open: true,
          message: `Import failed: ${importError.message}`,
          severity: 'error'
        });
        return;
      }

      // CRITICAL: Wait for annotations to be committed to the PDF document
      // The annotation plugin needs time to process and generate appearance streams
      console.log('⏳ Waiting for import to commit and appearance streams to generate...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force a re-render of the viewer to ensure the new annotations are displayed
      // This is a workaround for cases where the annotation layer might not update automatically
      if (pdfViewerRef.current?.zoom) {
        console.log('🔄 Forcing viewer refresh via zoom...');
        const currentZoom = pdfViewerRef.current.zoom.getZoom();
        pdfViewerRef.current.zoom.setZoom(currentZoom * 1.0001);
        await new Promise(resolve => setTimeout(resolve, 50));
        pdfViewerRef.current.zoom.setZoom(currentZoom);
      }

      // Sync the imported annotations with our local state using getAllAnnotations()
      // This ensures the UI state matches what's actually in the PDF engine
      console.log('🔄 Syncing imported annotations with local state...');
      const allAnnotationsInEngine = annotationAPI.getAllAnnotations?.() || [];
      console.log('📊 Found', allAnnotationsInEngine.length, 'annotations in engine');

      // Log stamp annotations from getAllAnnotations to see what properties are available
      allAnnotationsInEngine.filter(a => a.type === 13).forEach(stamp => {
        console.log('🖼️ STAMP from getAllAnnotations:', {
          id: stamp.id?.substring(0, 8),
          hasImageSrc: !!stamp.imageSrc,
          imageSrcLength: stamp.imageSrc?.length,
          imageSize: stamp.imageSize,
          rect: stamp.rect,
          allKeys: Object.keys(stamp)
        });
      });

      // Convert to serialized format and update state
      // IMPORTANT: We need to preserve imageSrc from the savedAnnotations we tried to import
      const serializedAnnotations = allAnnotationsInEngine
        .filter(ann => [8, 9, 10, 11, 13, 15].includes(ann.type)) // Only supported types: Highlight, Underline, Squiggly, StrikeOut, Stamp, Ink
        .map(ann => {
          // For text markup annotations (Highlight, Underline, etc.), ensure segmentRects exists
          // If missing (legacy data or serialization issue), polyfill it from main rect to prevent crash
          if ([8, 9, 10, 11].includes(ann.type) && !ann.segmentRects) {
            console.warn(`⚠️ Polyfilling missing segmentRects for annotation ${ann.id?.substring(0, 8)}`);
            // Ensure segmentRects is copied, not just referenced, if ann.rect is an object
            ann.segmentRects = ann.rect ? [JSON.parse(JSON.stringify(ann.rect))] : [];
          }

          let imageSrc = ann.imageSrc; // Initialize imageSrc from the annotation itself

          // For stamp annotations, try to restore imageSrc from our saved data if not present
          if (ann.type === 13 && !imageSrc) {
            // Find the matching saved annotation by ID
            const savedAnn = savedAnnotations.find(s => s.id === ann.id);
            if (savedAnn?.custom?.imageSrc) {
              imageSrc = savedAnn.custom.imageSrc;
              // Also ensure we keep the custom field on the annotation being processed
              ann.custom = { ...ann.custom, imageSrc };
            } else if (savedAnn?.imageSrc) {
              imageSrc = savedAnn.imageSrc;
            }
          }

          return {
            ...ann,
            imageSrc, // Explicitly set imageSrc
            created: ann.created instanceof Date ? ann.created.toISOString() : ann.created,
            modified: ann.modified instanceof Date ? ann.modified.toISOString() : ann.modified,
          };
        });

      annotationsFromEvents.current = serializedAnnotations;
      setAllAnnotations(serializedAnnotations);
      setAnnotationCount(serializedAnnotations.length);

      console.log('✅ State synced - imported annotations should now be visible');

      setSnackbar({
        open: true,
        message: result.failed > 0
          ? `Loaded ${result.success} annotations (${result.failed} failed)`
          : `Successfully loaded ${result.success} annotations!`,
        severity: result.failed > 0 ? 'warning' : 'success'
      });
    } catch (error) {
      console.error('❌ Error loading annotations:', error);
      setSnackbar({ open: true, message: 'Failed to load annotations: ' + error.message, severity: 'error' });
    }
  };

  const handlePrintWithAnnotations = async () => {
    if (!pdfViewerRef.current?.print) {
      console.error('Print API not available');
      setSnackbar({ open: true, message: 'Print feature not available', severity: 'error' });
      return;
    }

    try {
      console.log('🖨️ Printing with annotations...');
      await pdfViewerRef.current.print.printWithAnnotations();
      setSnackbar({ open: true, message: 'Print dialog opened (with annotations)', severity: 'success' });
    } catch (error) {
      console.error('❌ Error printing with annotations:', error);
      setSnackbar({ open: true, message: 'Failed to print with annotations', severity: 'error' });
    }
  };

  const handlePrintWithoutAnnotations = async () => {
    if (!pdfViewerRef.current?.print) {
      console.error('Print API not available');
      setSnackbar({ open: true, message: 'Print feature not available', severity: 'error' });
      return;
    }

    try {
      console.log('🖨️ Printing without annotations...');
      await pdfViewerRef.current.print.printWithoutAnnotations();
      setSnackbar({ open: true, message: 'Print dialog opened (without annotations)', severity: 'success' });
    } catch (error) {
      console.error('❌ Error printing without annotations:', error);
      setSnackbar({ open: true, message: 'Failed to print without annotations', severity: 'error' });
    }
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

  // Removed polling mechanism - getAllAnnotations() returns empty array
  // We rely entirely on 
  //  below

  // Listen to annotation events and sync with Redux
  useEffect(() => {
    if (!pdfBuffer || !selectedFile) {
      console.log('⏸️ Annotation listener not ready - no pdfBuffer or selectedFile');
      return;
    }

    const documentName = selectedFile.name;
    let unsubscribeFn = null;
    let checkInterval = null;

    // Poll until annotation API is available
    const setupListener = () => {
      if (pdfViewerRef.current?.annotation?.onAnnotationEvent) {
        console.log('🎧 Setting up annotation event listener for:', documentName);

        unsubscribeFn = pdfViewerRef.current.annotation.onAnnotationEvent((event) => {
          console.log('🔔 Annotation event:', event.type, 'committed:', event.committed);

          if (!event.annotation) {
            console.log('⚠️ Event has no annotation data, skipping');
            return;
          }

          // Only process committed events for persistence (as per EmbedPDF docs)
          const isCommitted = event.committed !== false;
          if (!isCommitted) {
            console.log('⏭️ Skipping uncommitted event');
            return;
          }

          // Filter for only supported annotation types:
          // Type 8: Highlight
          // Type 9: Underline (often used by highlighter tool depending on config)
          // Type 10: Squiggly
          // Type 11: StrikeOut
          // Type 13: Stamp
          // Type 15: Ink/Signature
          const supportedTypes = [8, 9, 10, 11, 13, 15];
          if (!supportedTypes.includes(event.annotation.type)) {
            console.log(`⏭️ Skipping unsupported annotation type: ${event.annotation.type}`);
            return;
          }

          // Handle 'loaded' events - these fire once when initial annotations are loaded from the document
          // Note: 'loaded' event only contains 'total' count, not individual annotation data
          if (event.type === 'loaded') {
            console.log('📥 Loaded event received - initial annotations loaded from document');
            console.log('📊 Total annotations in document:', event.total || 0);
            // Don't process individual annotations here - they'll come through 'create' events
            // or we'll fetch them manually using getAllAnnotations() after importAnnotations()
            return;
          }

          console.log(`📋 Processing ${event.type} event for annotation:`, event.annotation.id?.substring(0, 8), 'Type:', event.annotation.type);

          // For STAMP annotations, log ALL properties to see what we're getting
          if (event.annotation.type === 13) {
            console.log('🔍 RAW STAMP annotation from event:', {
              ...event.annotation,
              imageSrc: event.annotation.imageSrc ? `[DATA URL ${event.annotation.imageSrc.length} chars]` : 'MISSING',
              imageSize: event.annotation.imageSize
            });
            console.log('🔍 Event keys:', Object.keys(event.annotation));
          }

          if (event.type === 'create') {
            // Check if annotation already exists
            const exists = annotationsFromEvents.current.some(a => a.id === event.annotation.id);
            if (exists) {
              console.log('⚠️ Annotation already exists, skipping duplicate');
              return;
            }

            // Serialize the annotation for Redux (handle Date objects)
            const serializedAnnotation = {
              ...event.annotation,
              id: event.annotation.id || `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              created: event.annotation.created instanceof Date
                ? event.annotation.created.toISOString()
                : typeof event.annotation.created === 'string'
                  ? event.annotation.created
                  : new Date().toISOString(),
              modified: event.annotation.modified instanceof Date
                ? event.annotation.modified.toISOString()
                : typeof event.annotation.modified === 'string'
                  ? event.annotation.modified
                  : undefined,
            };

            // For STAMP annotations (type 13), capture imageData from ctx and store as data URL
            // This is CRITICAL for v2.x - the imageData is in event.ctx, not in the annotation object
            if (event.annotation.type === 13 && event.ctx?.imageData) {
              console.log('🖼️ STAMP: Found imageData in event.ctx, converting to data URL');
              const dataUrl = imageDataToDataUrl(event.ctx.imageData);
              // Store in custom field for persistence (v2.x pattern)
              serializedAnnotation.custom = {
                ...serializedAnnotation.custom,
                imageSrc: dataUrl,
                imageWidth: event.ctx.imageData.width,
                imageHeight: event.ctx.imageData.height,
              };
              console.log('🖼️ STAMP: Stored imageSrc in custom field, length:', dataUrl.length);
            }

            // Log STAMP annotation details for debugging
            if (event.annotation.type === 13) {
              console.log('🖼️ STAMP annotation created:', {
                id: serializedAnnotation.id?.substring(0, 8),
                hasCustomImageSrc: !!serializedAnnotation.custom?.imageSrc,
                customImageSrcLength: serializedAnnotation.custom?.imageSrc?.length,
                rect: serializedAnnotation.rect
              });
            }

            annotationsFromEvents.current.push(serializedAnnotation);
            const newCount = annotationsFromEvents.current.length;
            console.log('✅ Added annotation. Total:', newCount);

            // Update state
            setAllAnnotations([...annotationsFromEvents.current]);
            setAnnotationCount(newCount);

            // Sync with Redux
            dispatch(addAnnotation({
              documentName,
              annotation: serializedAnnotation
            }));

            // Deactivate stamp/signature tool after placement
            if (event.annotation.type === 13 || event.annotation.type === 15) {
              setIsStampActive(false);
              setIsSignatureActive(false);
            }
          } else if (event.type === 'update') {
            console.log('📝 Update event for annotation:', event.annotation.id?.substring(0, 8));

            // Check if we have this annotation
            const index = annotationsFromEvents.current.findIndex(a => a.id === event.annotation.id);

            if (index !== -1) {
              // Update existing annotation
              const updatedAnnotation = {
                ...annotationsFromEvents.current[index],
                ...event.annotation,
                modified: new Date().toISOString()
              };

              // Preserve custom imageSrc for stamps if not present in update
              if (updatedAnnotation.type === 13 && annotationsFromEvents.current[index].custom?.imageSrc) {
                if (!updatedAnnotation.custom) updatedAnnotation.custom = {};
                updatedAnnotation.custom.imageSrc = annotationsFromEvents.current[index].custom.imageSrc;
              }

              annotationsFromEvents.current[index] = updatedAnnotation;
              console.log('✅ Updated existing annotation');
            } else {
              // We don't have this annotation - it might have been created via an update event (common for some types)
              // or we missed the create event. Add it now.
              console.log('➕ Found new annotation via update event, adding it');

              const serializedAnnotation = {
                ...event.annotation,
                id: event.annotation.id, // Keep original ID
                created: new Date().toISOString(),
                modified: new Date().toISOString()
              };

              annotationsFromEvents.current.push(serializedAnnotation);
            }

            const newCount = annotationsFromEvents.current.length;
            setAllAnnotations([...annotationsFromEvents.current]);
            setAnnotationCount(newCount);

            // Sync with Redux? (Maybe overly chatty)

          } else if (event.type === 'delete') {
            annotationsFromEvents.current = annotationsFromEvents.current.filter(a => a.id !== event.annotation.id);
            const newCount = annotationsFromEvents.current.length;
            console.log('🗑️ Deleted annotation. Total:', newCount);

            // Update state
            setAllAnnotations([...annotationsFromEvents.current]);
            setAnnotationCount(newCount);

            // Sync with Redux
            dispatch(deleteReduxAnnotation({
              documentName,
              annotationId: event.annotation.id
            }));
          } else if (event.type === 'update') {
            // Serialize the annotation
            const serializedAnnotation = {
              ...event.annotation,
              created: event.annotation.created instanceof Date
                ? event.annotation.created.toISOString()
                : typeof event.annotation.created === 'string'
                  ? event.annotation.created
                  : new Date().toISOString(),
              modified: event.annotation.modified instanceof Date
                ? event.annotation.modified.toISOString()
                : typeof event.annotation.modified === 'string'
                  ? event.annotation.modified
                  : new Date().toISOString(),
            };

            const index = annotationsFromEvents.current.findIndex(a => a.id === event.annotation.id);
            if (index >= 0) {
              annotationsFromEvents.current[index] = serializedAnnotation;
              console.log('📝 Updated annotation');
              setAllAnnotations([...annotationsFromEvents.current]);

              // Sync with Redux
              dispatch(updateReduxAnnotation({
                documentName,
                annotationId: event.annotation.id,
                updates: serializedAnnotation
              }));
            } else {
              // If annotation doesn't exist, treat as create
              console.log('➕ Adding annotation from update event (was missing)');
              annotationsFromEvents.current.push(serializedAnnotation);
              setAllAnnotations([...annotationsFromEvents.current]);
              setAnnotationCount(annotationsFromEvents.current.length);

              dispatch(addAnnotation({
                documentName,
                annotation: serializedAnnotation
              }));
            }
          }
        });

        console.log('✅ Annotation event listener successfully registered!');
        console.log('🔍 Unsubscribe function:', typeof unsubscribeFn);

        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        return true;
      }
      return false;
    };

    // Try to set up immediately
    if (!setupListener()) {
      // If not ready, poll every 100ms until ready
      console.log('⏳ Waiting for annotation API to be ready...');
      checkInterval = setInterval(() => {
        console.log('⏳ Polling for annotation API...');
        setupListener();
      }, 100);
    }

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      if (typeof unsubscribeFn === 'function') {
        console.log('🔇 Unsubscribing from annotation events');
        unsubscribeFn();
      }
    };
  }, [pdfBuffer, selectedFile, dispatch]);

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
    const AnnotationMenu = ({ menuWrapperProps = {}, selected, rect, annotation }) => {
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
    return AnnotationMenu;
  }, [handleDeleteAnnotation]);

  // Filter annotations by type
  const getFilteredAnnotations = useCallback(() => {
    const annotations = allAnnotations;

    if (filterType === 'all') return annotations;
    if (filterType === 'signature') return annotations.filter(a => a.type === 13 || a.subject === 'Stamp');
    if (filterType === 'highlight') return annotations.filter(a => [8, 9, 10, 11].includes(a.type));
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
    console.log('  Highlights/Markup (type 8, 9, 10, 11):', data.filter(a => [8, 9, 10, 11].includes(a.type)).length);
    console.log('  Text/Notes:', data.filter(a => a.type === 3 || a.type === 1).length);
    console.log('  Others:', data.filter(a => ![13, 8, 9, 10, 11, 3, 1].includes(a.type)).length);

    data.forEach((ann, idx) => {
      console.log(`\n📝 Annotation ${idx + 1}:`);
      console.log(JSON.stringify(ann, null, 2));
    });
    console.log('\n' + '='.repeat(80));
    console.log('📦 Complete array:');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(80));
    alert(`${data.length} annotations logged to console.\n\nBreakdown:\n- Signatures: ${data.filter(a => a.type === 13).length}\n- Highlights/Markup: ${data.filter(a => [8, 9, 10, 11].includes(a.type)).length}\n- Text: ${data.filter(a => a.type === 3 || a.type === 1).length}\n\nCheck Developer Tools (F12)`);
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

          {/* Save/Load Controls */}
          {pdfBuffer && (
            <Box sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleSaveAnnotations}
                startIcon={<Save />}
                disabled={annotationCount === 0}
              >
                Save Annotations ({annotationCount})
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                onClick={handleLoadAnnotations}
                startIcon={<CloudUpload />}
                disabled={savedAnnotations.length === 0}
              >
                Load Saved ({savedAnnotations.length})
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleClearSavedAnnotations}
                startIcon={<Delete />}
                disabled={savedAnnotations.length === 0}
              >
                Clear Current
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleClearAllSavedAnnotations}
                startIcon={<Delete />}
              >
                Clear All Storage
              </Button>
              <Button
                variant="outlined"
                color="info"
                size="small"
                onClick={() => {
                  console.log('🔍 MANUAL DEBUG CHECK');
                  console.log('📊 Current annotationCount state:', annotationCount);
                  console.log('📦 Stored in ref:', annotationsFromEvents.current.length);
                  console.log('📋 Annotations from events:', JSON.stringify(annotationsFromEvents.current, null, 2));

                  // Check viewer annotations
                  if (pdfViewerRef.current?.annotation?.provides) {
                    const viewerAnnotations = pdfViewerRef.current.annotation.provides.getAllAnnotations?.() || [];
                    console.log('👁️ Annotations in viewer (getAllAnnotations):', viewerAnnotations.length);
                    console.log('👁️ Viewer annotations:', JSON.stringify(viewerAnnotations, null, 2));
                  } else {
                    console.log('⚠️ Viewer annotation API not available');
                  }

                  // Check saved annotations
                  console.log('💾 Saved annotations in Redux:', savedAnnotations.length);
                  if (savedAnnotations.length > 0) {
                    console.log('💾 First saved annotation:', JSON.stringify(savedAnnotations[0], null, 2));
                  }

                  console.log('⚠️ Note: getAllAnnotations() may return empty - we rely on onAnnotationEvent');

                  if (annotationsFromEvents.current.length === 0) {
                    alert('No annotations captured yet.\n\nMake sure onAnnotationEvent is firing when you add annotations.\nCheck console for "🔔 Annotation event received" messages.');
                  } else {
                    alert(`Found ${annotationsFromEvents.current.length} annotations in memory.\nCurrent state shows: ${annotationCount}\n\nCheck console for full details.`);
                  }
                }}
              >
                🔍 Debug Check
              </Button>
              {hasUnsavedChanges && (
                <Chip
                  label="Unsaved Changes"
                  color="warning"
                  size="small"
                  sx={{ ml: 1 }}
                />
              )}
              {lastSaved && !hasUnsavedChanges && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  Last saved: {new Date(lastSaved).toLocaleTimeString()}
                </Typography>
              )}
            </Box>
          )}

          {/* Print Controls */}
          {pdfBuffer && (
            <Box sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handlePrintWithAnnotations}
                startIcon={<Print />}
              >
                Print with Annotations
              </Button>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={handlePrintWithoutAnnotations}
                startIcon={<Print />}
              >
                Print without Annotations
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
                      const uniqueKey = `${ann.id || `ann-${idx}`}-${idx}`;

                      return (
                        <Paper key={uniqueKey} sx={{ p: 1.5, '&:hover': { backgroundColor: 'action.hover' } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {typeLabel} {ann.subject && `• ${ann.subject}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Page {ann.pageIndex + 1} • ID: {ann.id?.substring(0, 8) || 'N/A'}... • {position}
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
