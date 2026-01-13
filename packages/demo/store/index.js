/**
 * Redux Store Configuration
 * Configures the Redux store with Redux Toolkit and redux-persist
 */

import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web
import annotationsReducer from './annotationsSlice';

// Persist configuration
const persistConfig = {
    key: 'pdf-annotations',
    storage,
    // Only persist the documents data, not loading/error states
    whitelist: ['documents', 'currentDocumentName'],
};

// Create a persisted reducer
const persistedAnnotationsReducer = persistReducer(persistConfig, annotationsReducer);

export const store = configureStore({
    reducer: {
        annotations: persistedAnnotationsReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types from serializability check
                // (annotations may contain non-serializable data temporarily)
                ignoredActions: [
                    'annotations/addAnnotation',
                    'annotations/updateAnnotation',
                    'annotations/save/pending',
                    'annotations/save/fulfilled',
                    'annotations/save/rejected',
                    'annotations/load/pending',
                    'annotations/load/fulfilled',
                    'annotations/load/rejected',
                    'persist/PERSIST',
                    'persist/REHYDRATE',
                ],
                // Ignore these field paths in all actions
                ignoredActionPaths: [
                    'payload.rect',
                    'payload._raw',
                    'payload.created',
                    'payload.modified',
                    'meta.arg.annotations',
                    'register',
                    'rehydrate',
                ],
                // Ignore these paths in the state
                ignoredPaths: ['annotations.documents', 'register', '_persist'],
            },
        }),
    devTools: process.env.NODE_ENV !== 'production',
});

// Create persistor
export const persistor = persistStore(store);

// Export types for TypeScript support (if needed later)
export const getState = store.getState;
export const dispatch = store.dispatch;
