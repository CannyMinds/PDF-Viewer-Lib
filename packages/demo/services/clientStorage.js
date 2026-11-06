/**
 * Client-Side Storage API
 * Since Next.js API routes run on server, we need client-side storage
 * This simulates an API using localStorage
 */

const STORAGE_PREFIX = 'pdf-annotations-';

/**
 * Save annotations to localStorage (client-side mock API)
 */
export async function saveToStorage(documentId, annotations, metadata = {}) {
    try {
        const storageKey = `${STORAGE_PREFIX}${documentId}`;
        const data = {
            documentId,
            annotations,
            metadata: {
                ...metadata,
                savedAt: new Date().toISOString(),
                annotationCount: annotations.length,
            },
        };

        localStorage.setItem(storageKey, JSON.stringify(data));

        return {
            success: true,
            documentId,
            annotationCount: annotations.length,
            savedAt: data.metadata.savedAt,
        };
    } catch (error) {
        console.error('Error saving to storage:', error);
        throw error;
    }
}

/**
 * Load annotations from localStorage
 */
export async function loadFromStorage(documentId) {
    try {
        const storageKey = `${STORAGE_PREFIX}${documentId}`;
        const stored = localStorage.getItem(storageKey);

        if (!stored) {
            return { annotations: [], metadata: null };
        }

        const data = JSON.parse(stored);
        return data;
    } catch (error) {
        console.error('Error loading from storage:', error);
        throw error;
    }
}

/**
 * Delete annotations from localStorage
 */
export async function deleteFromStorage(documentId) {
    try {
        const storageKey = `${STORAGE_PREFIX}${documentId}`;
        localStorage.removeItem(storageKey);

        return {
            success: true,
            documentId,
            message: 'Annotations deleted successfully',
        };
    } catch (error) {
        console.error('Error deleting from storage:', error);
        throw error;
    }
}

/**
 * List all stored documents
 */
export function listStoredDocuments() {
    const documents = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                documents.push({
                    documentId: data.documentId,
                    annotationCount: data.annotations?.length || 0,
                    savedAt: data.metadata?.savedAt,
                });
            } catch (e) {
                console.warn(`Failed to parse storage key: ${key}`);
            }
        }
    }

    return documents;
}
