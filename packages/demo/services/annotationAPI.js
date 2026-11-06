/**
 * Annotation API Service
 * Handles all API calls for saving and loading annotations
 * Uses client-side localStorage as mock backend
 */

import { serializeAnnotations, deserializeAnnotations } from '../utils/annotationSerializer';
import { saveToStorage, loadFromStorage, deleteFromStorage } from './clientStorage';

/**
 * Save annotations to backend (localStorage mock)
 * @param {string} documentId - Unique document identifier (hash)
 * @param {Array} annotations - Array of annotation objects
 * @param {Object} metadata - Optional metadata (user info, etc)
 * @returns {Promise<Object>} - API response
 */
export async function saveAnnotationsAPI(documentId, annotations, metadata = {}) {
    try {
        const serialized = serializeAnnotations(annotations);
        const response = await saveToStorage(documentId, serialized, metadata);

        console.log(`✅ Saved ${annotations.length} annotations for document ${documentId.substring(0, 8)}...`);
        return response;
    } catch (error) {
        console.error('Error saving annotations:', error);
        throw error;
    }
}

/**
 * Load annotations from backend (localStorage mock)
 * @param {string} documentId - Unique document identifier (hash)
 * @returns {Promise<Object>} - API response with annotations
 */
export async function loadAnnotationsAPI(documentId) {
    try {
        const data = await loadFromStorage(documentId);
        const annotations = deserializeAnnotations(data.annotations || []);

        console.log(`✅ Loaded ${annotations.length} annotations for document ${documentId.substring(0, 8)}...`);

        return {
            annotations,
            metadata: data.metadata || null,
        };
    } catch (error) {
        console.error('Error loading annotations:', error);
        throw error;
    }
}

/**
 * Delete all annotations for a document
 * @param {string} documentId - Unique document identifier (hash)
 * @returns {Promise<Object>} - API response
 */
export async function deleteAnnotationsAPI(documentId) {
    try {
        const response = await deleteFromStorage(documentId);
        console.log(`✅ Deleted annotations for document ${documentId.substring(0, 8)}...`);
        return response;
    } catch (error) {
        console.error('Error deleting annotations:', error);
        throw error;
    }
}
