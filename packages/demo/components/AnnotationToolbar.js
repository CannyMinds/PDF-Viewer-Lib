import { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Divider,
  Chip
} from '@mui/material';
import {
  Highlight,
  Clear,
  Download,
  GetApp
} from '@mui/icons-material';

export default function AnnotationToolbar({ viewerRef }) {
  const [activeTool, setActiveTool] = useState(null);

  useEffect(() => {
    if (!viewerRef.current?.annotations?.getProvider) {
      return;
    }

    const annotationApi = viewerRef.current.annotations.getProvider();
    if (!annotationApi) {
      return;
    }

    // Subscribe to active tool changes
    const handleActiveToolChange = () => {
      const tool = annotationApi.getActiveTool();
      setActiveTool(tool?.id || null);
    };

    // Listen for tool changes (if available)
    if (annotationApi.onActiveToolChange) {
      annotationApi.onActiveToolChange(handleActiveToolChange);
    }

    // Get initial active tool
    handleActiveToolChange();

    return () => {
      // Cleanup subscription if available
      if (annotationApi.offActiveToolChange) {
        annotationApi.offActiveToolChange(handleActiveToolChange);
      }
    };
  }, [viewerRef]);

  const handleToolSelect = (toolId) => {
    if (!viewerRef.current?.annotations) return;

    const currentTool = activeTool;
    const newTool = currentTool === toolId ? null : toolId;

    viewerRef.current.annotations.setActiveTool(newTool);
    setActiveTool(newTool);
  };

  const handleTool = (toolId) => {
    if (!viewerRef.current?.annotations) return;
    viewerRef.current.annotations.setActiveTool(toolId);
  };

  const deleteSelected = () => {
    if (!viewerRef.current?.annotations) return;
    viewerRef.current.annotations.deleteSelected();
  };

  const downloadWithAnnotations = async () => {
    if (!viewerRef.current?.document?.download) return;

    try {
      await viewerRef.current.document.download(undefined, true);
    } catch (error) {
      // Download failed silently
    }
  };

  const downloadOriginal = async () => {
    if (!viewerRef.current?.document?.download) return;

    try {
      await viewerRef.current.document.download(undefined, false);
    } catch (error) {
      // Download failed silently
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        backgroundColor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {/* Active Tool Indicator */}
      {activeTool && (
        <>
          <Chip
            label={`Active: ${activeTool}`}
            color="primary"
            variant="outlined"
            size="small"
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        </>
      )}

      {/* Annotation Tools */}
      <ToggleButtonGroup
        value={activeTool}
        exclusive
        size="small"
        sx={{ gap: 0.5 }}
      >
        <Tooltip title="Highlight Text">
          <ToggleButton
            value="highlight"
            onClick={() => handleTool('highlight')}
            selected={activeTool === 'highlight'}
          >
            <Highlight />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Delete Selected">
          <ToggleButton
            value="delete"
            onClick={deleteSelected}
          >
            <Clear />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Download with Annotations">
          <ToggleButton
            value="download-annotated"
            onClick={downloadWithAnnotations}
          >
            <Download />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Download Original PDF">
          <ToggleButton
            value="download-original"
            onClick={downloadOriginal}
          >
            <GetApp />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      {/* Instructions */}
      <Box sx={{ ml: 'auto' }}>
        <Typography variant="caption" color="text.secondary">
          Click a tool to start annotating • Click again to deselect
        </Typography>
      </Box>
    </Box>
  );
}