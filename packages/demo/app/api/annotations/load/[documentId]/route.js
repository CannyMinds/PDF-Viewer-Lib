/**
 * Mock API Route: Load Annotations
 * GET /api/annotations/load/[documentId]
 * Loads annotations from localStorage (mock backend)
 */

import { NextResponse } from 'next/server';

const STORAGE_PREFIX = 'pdf-annotations-';

export async function GET(request, { params }) {
    try {
        const { documentId } = params;

        if (!documentId) {
            return NextResponse.json(
                { error: 'Document ID is required' },
                { status: 400 }
            );
        }

        // For server-side, check if we're in browser context
        // In production, this would query a database
        const storageKey = `${STORAGE_PREFIX}${documentId}`;

        // Since we're on the server, we'll simulate finding data
        // In practice, you'd want to use an actual data store
        // For now, return empty if not found

        // This is a mock - in real implementation, check your database
        // For demo purposes with client-side storage:
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                return NextResponse.json(data);
            }
        }

        // No annotations found
        return NextResponse.json(
            { error: 'No annotations found for this document' },
            { status: 404 }
        );
    } catch (error) {
        console.error('Error in load annotations API:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
