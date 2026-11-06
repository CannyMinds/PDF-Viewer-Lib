/**
 * Mock API Route: Save Annotations
 * POST /api/annotations/save
 * Saves annotations to localStorage (mock backend)
 */

import { NextResponse } from 'next/server';

const STORAGE_PREFIX = 'pdf-annotations-';

export async function POST(request) {
    try {
        const body = await request.json();
        const { documentId, annotations, metadata } = body;

        if (!documentId) {
            return NextResponse.json(
                { error: 'Document ID is required' },
                { status: 400 }
            );
        }

        if (!Array.isArray(annotations)) {
            return NextResponse.json(
                { error: 'Annotations must be an array' },
                { status: 400 }
            );
        }

        // Store in localStorage (server-side simulation)
        // In a real app, this would save to a database
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

        // For server-side, we'll use a simple in-memory store
        // In production, this would be a database
        if (typeof window !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify(data));
        }

        return NextResponse.json({
            success: true,
            documentId,
            annotationCount: annotations.length,
            savedAt: data.metadata.savedAt,
        });
    } catch (error) {
        console.error('Error in save annotations API:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
