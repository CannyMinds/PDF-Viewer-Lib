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
      console.log('searchQuery', searchQuery);
      
      const results = await viewerRef.current.search.searchText(searchQuery);
      console.log('results', results);
      setSearchResults(results);
      if (results && results.results && results.results.length > 0) {
        setCurrentResultIndex(0);
        // Start search session to activate result highlighting
        viewerRef.current.search.startSearch();
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNextResult = () => {
    if (viewerRef.current) {
      const newIndex = viewerRef.current.search.nextResult();
      setCurrentResultIndex(newIndex);
    }
  };

  const handlePreviousResult = () => {
    if (viewerRef.current) {
      const newIndex = viewerRef.current.search.previousResult();
      setCurrentResultIndex(newIndex);
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