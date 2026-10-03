import { createCapabilityToken, definePlugin } from "@embedpdf/core";
import type { Action, DocumentEvent, DocumentHandle, Engine } from "@embedpdf/core";

// A document-scoped plugin that hands the viewer the document's engine handle.
// The public plugin capabilities cover viewing and authoring, but a few things
// the viewer needs — the document event stream, saving a copy, pruning deleted
// form fields — live on the handle itself.
export interface BridgeCapability {
  /** The open document's engine handle. */
  doc(): DocumentHandle;
  /** The engine the document was opened with — for working on a throw-away copy of it. */
  engine(): Engine;
  /** Every engine event for this document (annotation / form mutations…). */
  onDocumentEvent(listener: (event: DocumentEvent) => void): () => void;
}

export const BridgeToken = createCapabilityToken<BridgeCapability>("cm-bridge");

export const bridgePlugin = () =>
  definePlugin<unknown, Action, BridgeCapability>({
    id: "cm-bridge",
    token: BridgeToken,
    scope: "document",
    capability: (ctx) => ({
      doc: () => {
        const doc = ctx.doc;
        if (!doc) throw new Error("[PDFViewer] the document is not open");
        return doc;
      },
      engine: () => ctx.engine,
      onDocumentEvent: (listener) => ctx.doc?.events.subscribe(listener) ?? (() => undefined),
    }),
  });
