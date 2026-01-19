/**
 * Redux Slice for Annotations
 * Manages annotation state with Redux Toolkit
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { saveAnnotationsAPI, loadAnnotationsAPI, deleteAnnotationsAPI } from '../services/annotationAPI';
import { normalizeAnnotation } from '../utils/annotationSerializer';

// Async thunks for API calls

/**
 * Save annotations to backend
 */
export const saveAnnotations = createAsyncThunk(
    'annotations/save',
    async ({ documentId, annotations, metadata }, { rejectWithValue }) => {
        try {
            const response = await saveAnnotationsAPI(documentId, annotations, metadata);
            return response;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

/**
 * Load annotations from backend
 */
export const loadAnnotations = createAsyncThunk(
    'annotations/load',
    async (documentId, { rejectWithValue }) => {
        try {
            const response = await loadAnnotationsAPI(documentId);
            return response;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

/**
 * Delete annotations from backend
 */
export const deleteAllAnnotations = createAsyncThunk(
    'annotations/deleteAll',
    async (documentId, { rejectWithValue }) => {
        try {
            const response = await deleteAnnotationsAPI(documentId);
            return response;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// Initial state - document-centric approach
const initialState = {
    // Store annotations per document
    documents: {
        // 'document.pdf': {
        //     annotations: [...],
        //     lastSaved: timestamp,
        //     hasUnsavedChanges: false
        // }
    },

    // Current document name
    currentDocumentName: null,

    // Loading and sync states
    loading: false,
    saving: false,
    error: null,

    // Sync status: 'idle' | 'pending' | 'succeeded' | 'failed'
    syncStatus: 'idle',
};

// Slice
const annotationsSlice = createSlice({
    name: 'annotations',
    initialState,
    reducers: {
        /**
         * Set current document
         */
        setCurrentDocument: (state, action) => {
            const documentName = action.payload;
            state.currentDocumentName = documentName;

            // Initialize document if it doesn't exist
            if (!state.documents[documentName]) {
                state.documents[documentName] = {
                    annotations: [],
                    lastSaved: null,
                    hasUnsavedChanges: false,
                };
            }
        },

        /**
         * Add a new annotation to a specific document
         */
        addAnnotation: (state, action) => {
            const { documentName, annotation } = action.payload;
            const normalized = normalizeAnnotation(annotation);

            if (!state.documents[documentName]) {
                state.documents[documentName] = {
                    annotations: [],
                    lastSaved: null,
                    hasUnsavedChanges: false,
                };
            }

            // Check if annotation already exists
            const exists = state.documents[documentName].annotations.some(
                (a) => a.id === normalized.id
            );

            if (!exists) {
                state.documents[documentName].annotations.push(normalized);
                state.documents[documentName].hasUnsavedChanges = true;
            }
        },

        /**
         * Update an existing annotation
         */
        updateAnnotation: (state, action) => {
            const { documentName, annotationId, updates } = action.payload;

            if (!state.documents[documentName]) return;

            const index = state.documents[documentName].annotations.findIndex(
                (a) => a.id === annotationId
            );

            if (index >= 0) {
                state.documents[documentName].annotations[index] = {
                    ...state.documents[documentName].annotations[index],
                    ...normalizeAnnotation(updates),
                    modified: new Date().toISOString(),
                };
                state.documents[documentName].hasUnsavedChanges = true;
            }
        },

        /**
         * Delete an annotation
         */
        deleteAnnotation: (state, action) => {
            const { documentName, annotationId } = action.payload;

            if (!state.documents[documentName]) return;

            state.documents[documentName].annotations = state.documents[documentName].annotations.filter(
                (a) => a.id !== annotationId
            );
            state.documents[documentName].hasUnsavedChanges = true;
        },

        /**
         * Replace all annotations for a document
         */
        replaceAllAnnotations: (state, action) => {
            const { documentName, annotations } = action.payload;

            if (!state.documents[documentName]) {
                state.documents[documentName] = {
                    annotations: [],
                    lastSaved: null,
                    hasUnsavedChanges: false,
                };
            }

            state.documents[documentName].annotations = annotations.map(normalizeAnnotation);
            state.documents[documentName].hasUnsavedChanges = true;
        },

        /**
         * Clear all annotations for current document
         */
        clearAnnotations: (state) => {
            if (state.currentDocumentName && state.documents[state.currentDocumentName]) {
                state.documents[state.currentDocumentName].annotations = [];
                state.documents[state.currentDocumentName].hasUnsavedChanges = true;
            }
        },

        /**
         * Clear all annotations for a specific document
         */
        clearDocumentAnnotations: (state, action) => {
            const { documentName } = action.payload;
            if (state.documents[documentName]) {
                delete state.documents[documentName];
            }
        },

        /**
         * Clear annotations for current document (alias for clearDocumentAnnotations)
         */
        clearCurrentAnnotations: (state, action) => {
            const { documentName } = action.payload;
            if (state.documents[documentName]) {
                delete state.documents[documentName];
            }
        },

        /**
         * Mark annotations as saved
         */
        markAsSaved: (state, action) => {
            const { documentName } = action.payload;
            if (state.documents[documentName]) {
                state.documents[documentName].lastSaved = new Date().toISOString();
                state.documents[documentName].hasUnsavedChanges = false;
            }
        },

        /**
         * Reset entire state
         */
        resetState: () => initialState,
    },

    extraReducers: (builder) => {
        builder
            // Save annotations
            .addCase(saveAnnotations.pending, (state) => {
                state.saving = true;
                state.syncStatus = 'pending';
                state.error = null;
            })
            .addCase(saveAnnotations.fulfilled, (state, action) => {
                state.saving = false;
                state.syncStatus = 'succeeded';
                state.lastSyncTime = new Date().toISOString();
            })
            .addCase(saveAnnotations.rejected, (state, action) => {
                state.saving = false;
                state.syncStatus = 'failed';
                state.error = action.payload || 'Failed to save annotations';
            })

            // Load annotations
            .addCase(loadAnnotations.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loadAnnotations.fulfilled, (state, action) => {
                state.loading = false;

                // Clear existing annotations
                state.byId = {};
                state.allIds = [];

                // Load new annotations
                if (action.payload.annotations && Array.isArray(action.payload.annotations)) {
                    action.payload.annotations.forEach((ann) => {
                        const normalized = normalizeAnnotation(ann);
                        state.byId[normalized.id] = normalized;
                        state.allIds.push(normalized.id);
                    });
                }

                state.documentMetadata = action.payload.metadata;
                state.syncStatus = 'succeeded';
            })
            .addCase(loadAnnotations.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to load annotations';
            })

            // Delete all annotations
            .addCase(deleteAllAnnotations.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteAllAnnotations.fulfilled, (state) => {
                state.loading = false;
                state.byId = {};
                state.allIds = [];
                state.syncStatus = 'succeeded';
            })
            .addCase(deleteAllAnnotations.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to delete annotations';
            });
    },
});

// Export actions
export const {
    setCurrentDocument,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    replaceAllAnnotations,
    clearAnnotations,
    clearDocumentAnnotations,
    clearCurrentAnnotations,
    markAsSaved,
    resetState,
} = annotationsSlice.actions;

// Selectors
export const selectCurrentDocumentName = (state) => state.annotations.currentDocumentName;

export const selectCurrentDocumentAnnotations = (state) => {
    const docName = state.annotations.currentDocumentName;
    if (!docName || !state.annotations.documents[docName]) {
        return [];
    }
    return state.annotations.documents[docName].annotations;
};

export const selectHasUnsavedChanges = (state) => {
    const docName = state.annotations.currentDocumentName;
    if (!docName || !state.annotations.documents[docName]) {
        return false;
    }
    return state.annotations.documents[docName].hasUnsavedChanges;
};

export const selectLastSaved = (state) => {
    const docName = state.annotations.currentDocumentName;
    if (!docName || !state.annotations.documents[docName]) {
        return null;
    }
    return state.annotations.documents[docName].lastSaved;
};

export const selectAnnotationsForDocument = (state, documentName) => {
    if (!state.annotations.documents[documentName]) {
        return [];
    }
    return state.annotations.documents[documentName].annotations;
};

export const selectAnnotationById = (state, annotationId) => {
    const docName = state.annotations.currentDocumentName;
    if (!docName || !state.annotations.documents[docName]) {
        return null;
    }
    return state.annotations.documents[docName].annotations.find((a) => a.id === annotationId);
};

export const selectAnnotationsByPage = (state, pageIndex) => {
    const docName = state.annotations.currentDocumentName;
    if (!docName || !state.annotations.documents[docName]) {
        return [];
    }
    return state.annotations.documents[docName].annotations.filter((ann) => ann.pageIndex === pageIndex);
};

export const selectAnnotationsLoading = (state) => state.annotations.loading;

export const selectAnnotationsSaving = (state) => state.annotations.saving;

export const selectSyncStatus = (state) => state.annotations.syncStatus;

export const selectAnnotationsError = (state) => state.annotations.error;

export const selectAnnotationsCount = (state) => {
    const docName = state.annotations.currentDocumentName;
    if (!docName || !state.annotations.documents[docName]) {
        return 0;
    }
    return state.annotations.documents[docName].annotations.length;
};

export const selectAllDocuments = (state) => Object.keys(state.annotations.documents);

// Export reducer
export default annotationsSlice.reducer;
