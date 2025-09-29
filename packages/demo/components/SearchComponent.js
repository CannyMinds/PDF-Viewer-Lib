import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  Chip
} from '@mui/material';
import { Search, Clear, NavigateBefore, NavigateNext } from '@mui/icons-material';

export default function SearchComponent({ viewerRef }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !viewerRef.current) return;

    setIsSearching(true);
    try {
      
      const results = await viewerRef.current.search.searchText(searchQuery);
      setSearchResults(results);
      if (results && results.results && results.results.length > 0) {
        setCurrentResultIndex(0);
        // Start search session to activate result highlighting
        viewerRef.current.search.startSearch();

        // Navigate to the first result using proper coordinates
        const firstResult = results.results[0];

        // Use EmbedPDF's coordinate-based scrolling
        if (firstResult && firstResult.rects && firstResult.rects.length > 0) {
          const minCoordinates = firstResult.rects.reduce(
            (min, rect) => ({
              x: Math.min(min.x, rect.origin.x),
              y: Math.min(min.y, rect.origin.y),
            }),
            { x: Infinity, y: Infinity },
          );

          // Use coordinate-based scrolling directly
          viewerRef.current.scroll.scrollToPage({
            pageNumber: firstResult.pageIndex + 1,
            pageCoordinates: minCoordinates,
            center: true,
          });
        }
      }
    } catch (error) {
      // Search error occurred
    } finally {
      setIsSearching(false);
    }
  };

  const handleNextResult = () => {
    if (viewerRef.current && searchResults) {
      const newIndex = viewerRef.current.search.nextResult();
      setCurrentResultIndex(newIndex);

      // If EmbedPDF doesn't auto-navigate, do it manually
      if (newIndex >= 0 && searchResults.results && searchResults.results[newIndex]) {
        const result = searchResults.results[newIndex];
        // Navigate to current result

        // Use coordinate-based scrolling for precise positioning
        if (result.rects && result.rects.length > 0) {
          const minCoordinates = result.rects.reduce(
            (min, rect) => ({
              x: Math.min(min.x, rect.origin.x),
              y: Math.min(min.y, rect.origin.y),
            }),
            { x: Infinity, y: Infinity },
          );

          viewerRef.current.scroll.scrollToPage({
            pageNumber: result.pageIndex + 1,
            pageCoordinates: minCoordinates,
            center: true,
          });
        }
      }
    }
  };

  const handlePreviousResult = () => {
    if (viewerRef.current && searchResults) {
      const newIndex = viewerRef.current.search.previousResult();
      setCurrentResultIndex(newIndex);

      // If EmbedPDF doesn't auto-navigate, do it manually
      if (newIndex >= 0 && searchResults.results && searchResults.results[newIndex]) {
        const result = searchResults.results[newIndex];
        // Navigate to current result

        // Use coordinate-based scrolling for precise positioning
        if (result.rects && result.rects.length > 0) {
          const minCoordinates = result.rects.reduce(
            (min, rect) => ({
              x: Math.min(min.x, rect.origin.x),
              y: Math.min(min.y, rect.origin.y),
            }),
            { x: Infinity, y: Infinity },
          );

          viewerRef.current.scroll.scrollToPage({
            pageNumber: result.pageIndex + 1,
            pageCoordinates: minCoordinates,
            center: true,
          });
        }
      }
    }
  };

  const handleClearSearch = () => {
    if (viewerRef.current) {
      viewerRef.current.search.stopSearch();
    }
    setSearchQuery('');
    setSearchResults(null);
    setCurrentResultIndex(-1);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const resultCount = searchResults?.results?.length || 0;

  return (
    <Box
      sx={{
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'grey.50',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap'
      }}
    >
      {/* Search Input */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Search in PDF..."
          disabled={isSearching}
          sx={{ width: 250 }}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />
          }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          size="small"
          sx={{ minWidth: 100 }}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </Box>

      {/* Results Info */}
      {searchResults && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={
              resultCount > 0
                ? `${currentResultIndex + 1} of ${resultCount} results`
                : 'No results found'
            }
            size="small"
            variant="outlined"
            color={resultCount > 0 ? 'primary' : 'default'}
          />

          {/* Show current result page */}
          {resultCount > 0 && searchResults && currentResultIndex >= 0 && searchResults.results[currentResultIndex] && (
            <Chip
              label={`Page ${searchResults.results[currentResultIndex].pageIndex + 1 || '?'}`}
              size="small"
              variant="filled"
              color="secondary"
            />
          )}

          {resultCount > 0 && (
            <>
              <IconButton
                onClick={handlePreviousResult}
                disabled={resultCount === 0}
                size="small"
                title="Previous result"
              >
                <NavigateBefore />
              </IconButton>
              <IconButton
                onClick={handleNextResult}
                disabled={resultCount === 0}
                size="small"
                title="Next result"
              >
                <NavigateNext />
              </IconButton>
            </>
          )}
        </Box>
      )}

      {/* Clear Button */}
      {(searchQuery || searchResults) && (
        <IconButton
          onClick={handleClearSearch}
          size="small"
          title="Clear search"
          sx={{ ml: 'auto' }}
        >
          <Clear />
        </IconButton>
      )}
    </Box>
  );
}