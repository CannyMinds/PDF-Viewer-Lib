import * as React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  AnnotationLayer,
  DocumentGate,
  DocumentScope,
  FormLayer,
  RenderLayer,
  SearchLayer,
  SelectionLayer,
  Stage,
  StageToken,
  Viewer,
  usePage,
  useCapability,
  useDocuments,
  useKernel,
} from "@embedpdf/react";
import type { StageCapability } from "@embedpdf/react";
import { Rotation, ScrollStrategy, ZoomMode, degreesToRotation, rotationToDegrees } from "./compat";
import { createAnnotationApi } from "./api/annotationApi";
import type { ClickToPlaceData } from "./api/annotationApi";
import { createDocumentApi } from "./api/documentApi";
import { createSearchApi } from "./api/searchApi";
import { createSelectionApi } from "./api/selectionApi";
import { createFormsApi } from "./api/formsApi";
import { AnnotationHub } from "./annotations/hub";
import { FormsController } from "./forms/controller";
import { AnnotationDeleteMenu } from "./components/AnnotationDeleteMenu";
import { PasswordGate } from "./components/PasswordGate";
import { LockModeType } from "./lock-types";
import type { LockMode } from "./lock-types";
import { createEngine, viewerPlugins } from "./runtime";
import type { PDFViewerProps, PDFViewerRef, PermissionConfig } from "./types/public";

export type {
  AnnotationSelectionMenu,
  FormFieldChanges,
  FormFieldDetails,
  FormFieldInfo,
  FormFieldKind,
  FormFieldOption,
  FormFieldToolType,
  PDFFormState,
  PDFViewerProps,
  PDFViewerRef,
  PermissionConfig,
  RenameFormFieldResult,
  SearchAllPagesResult,
  SearchResult,
  SearchState,
} from "./types/public";
export { FORM_FIELD_LABEL_MARKER, isFormFieldLabel } from "./forms/labels";
export { ZoomMode, Rotation };

let documentSeq = 0;

const centered = (content: React.ReactNode): ReactElement => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", backgroundColor: "#f5f5f5" }}>
    <div style={{ textAlign: "center" }}>{content}</div>
  </div>
);

// The `permissions` prop in terms of the engine's capability scope. Without it
// the document is fully permitted, as before. With it, a capability is granted
// unless an override denies it.
//
// Annotation writes are always granted at engine level: showing the annotations a
// host stores for the document means creating them here, and the host also sets
// their lock flags afterwards. `modifyAnnotations: false` is enforced by the viewer
// instead (no drawing tools, no deleting) — see `denyAnnotationEdits`.
const scopeFor = (permissions: PermissionConfig | undefined): string[] => {
  if (!permissions) return ["*"];
  const o = permissions.overrides ?? {};
  const allow = (flag: boolean | undefined) => flag !== false;
  const scope = ["doc.open", "doc.render", "doc.text.search", "doc.text.select", "doc.annotate.read", "doc.forms.read", "doc.download", "doc.download.flattened"];
  if (allow(o.print)) scope.push("doc.print");
  if (allow(o.printHighQuality) && allow(o.print)) scope.push("doc.print.high");
  if (allow(o.copyContents)) scope.push("doc.text.copy", "doc.content.copy");
  scope.push("doc.annotate.modify");
  if (allow(o.fillForms)) scope.push("doc.forms.fill");
  if (allow(o.modifyContents)) scope.push("doc.forms.modify");
  if (allow(o.assembleDocument)) scope.push("doc.pages.modify", "doc.pages.assemble");
  return scope;
};

type BodyProps = Pick<
  PDFViewerProps,
  | "pdfBuffer"
  | "password"
  | "onPasswordRequest"
  | "onDocumentLoad"
  | "hideInternalLoading"
  | "twoPageMode"
  | "scrollStrategy"
  | "onPageChange"
  | "userDetails"
  | "permissions"
  | "enableFormFilling"
  | "enableFormDesign"
  | "onFormStateChange"
  | "onFormFieldSelect"
>;

// Lives inside <Viewer>: opens the document, handles its password, and — once
// it is ready — mounts the stage and the imperative ref API.
const ViewerBody = forwardRef<PDFViewerRef, BodyProps>(function ViewerBody(props, ref) {
  const {
    pdfBuffer, password, onPasswordRequest, onDocumentLoad, hideInternalLoading, twoPageMode, scrollStrategy, onPageChange,
    userDetails, permissions, enableFormFilling = false, enableFormDesign = false, onFormStateChange, onFormFieldSelect,
  } = props;
  // The password that opened the document — needed to open a copy of it for saving.
  const passwordRef = useRef<string | undefined>(password);
  passwordRef.current = password;
  const handlePasswordAccepted = useCallback((accepted: string) => {
    passwordRef.current = accepted;
  }, []);
  const documents = useDocuments();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const scope = useMemo(() => scopeFor(permissions), [permissions]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  // Open the buffer; a new buffer replaces the previous document.
  useEffect(() => {
    if (!pdfBuffer) {
      setDocumentId(null);
      return undefined;
    }
    const id = `pdf-${++documentSeq}-${Math.random().toString(36).slice(2, 9)}`;
    // The engine takes ownership of the bytes it is given, so hand it a copy.
    const bytes = pdfBuffer instanceof Uint8Array ? pdfBuffer.slice() : new Uint8Array(pdfBuffer as ArrayBuffer).slice();
    setDocumentId(id);
    documents
      .open({ kind: "bytes", id, bytes }, { name: "document.pdf", activate: true, scope: scopeRef.current, ...(password ? { password } : {}) })
      .catch(() => undefined);
    return () => {
      documents.close(id).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfBuffer]);

  const info = documents.docs.find((d) => d.id === documentId) ?? null;

  if (!documentId || !info) {
    return hideInternalLoading ? null : centered(<div>Loading PDF...</div>);
  }

  return (
    <DocumentScope id={documentId}>
      <PasswordGate
        documentId={documentId}
        info={info}
        {...(onPasswordRequest ? { onPasswordRequest } : {})}
        onPasswordAccepted={handlePasswordAccepted}
      />
      <DocumentGate
        fallback={
          hideInternalLoading
            ? null
            : centered(<div>{info.status === "locked" ? "Waiting for password..." : info.status === "error" ? "Failed to load PDF" : "Loading PDF content..."}</div>)
        }
      >
        <ReadyViewer
          ref={ref}
          documentId={documentId}
          pdfBuffer={pdfBuffer}
          twoPageMode={twoPageMode}
          scrollStrategy={scrollStrategy}
          onPageChange={onPageChange}
          onDocumentLoad={onDocumentLoad}
          userDetails={userDetails}
          denyAnnotationEdits={permissions?.overrides?.modifyAnnotations === false}
          enableFormFilling={enableFormFilling}
          enableFormDesign={enableFormDesign}
          onFormStateChange={onFormStateChange}
          onFormFieldSelect={onFormFieldSelect}
          password={passwordRef}
        />
      </DocumentGate>
    </DocumentScope>
  );
});

interface ReadyProps {
  documentId: string;
  pdfBuffer: PDFViewerProps["pdfBuffer"];
  twoPageMode: boolean | undefined;
  scrollStrategy: ScrollStrategy | undefined;
  onPageChange: ((page: number) => void) | undefined;
  onDocumentLoad: PDFViewerProps["onDocumentLoad"];
  userDetails: PDFViewerProps["userDetails"];
  denyAnnotationEdits: boolean;
  enableFormFilling: boolean;
  enableFormDesign: boolean;
  onFormStateChange: PDFViewerProps["onFormStateChange"];
  onFormFieldSelect: PDFViewerProps["onFormFieldSelect"];
  password: { current: string | undefined };
}

// While click-to-place is on, a click anywhere on a page is reported instead of
// reaching the page's own layers.
const ClickToPlaceLayer = ({ active, handler }: { active: boolean; handler: { current: ((c: ClickToPlaceData) => void) | null } }) => {
  const page = usePage();
  if (!active) return null;
  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 50, cursor: "crosshair" }}
      onClick={(e) => {
        const callback = handler.current;
        if (!callback) return;
        const point = page.toContentPoint(e.clientX, e.clientY);
        handler.current = null;
        callback({
          pageIndex: page.pageIndex,
          x: point.x,
          y: point.y,
          pageWidth: page.transform.contentWidth,
          pageHeight: page.transform.contentHeight,
          target: e.currentTarget,
        });
      }}
    />
  );
};

// The form fields of a page. Filling mode: the user types into them. View mode:
// they show their values but can't be focused or changed (`inert` blocks pointer
// and keyboard for the whole subtree). In design mode the active tool is not a
// filling one, so the layer steps aside by itself.
const FormFillSurface = ({ fillable }: { fillable: boolean }) => {
  const setInert = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      if (fillable) el.removeAttribute("inert");
      else el.setAttribute("inert", "");
    },
    [fillable],
  );
  return (
    <div ref={setInert} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <FormLayer />
    </div>
  );
};

// Rendered once the document is ready: everything below can resolve the
// document's capabilities.
const ReadyViewer = forwardRef<PDFViewerRef, ReadyProps>(function ReadyViewer(
  { documentId, pdfBuffer, twoPageMode, scrollStrategy, onPageChange, onDocumentLoad, userDetails, denyAnnotationEdits, enableFormFilling, enableFormDesign, onFormStateChange, onFormFieldSelect, password },
  ref,
) {
  const kernel = useKernel();
  const stage = useCapability(StageToken) as StageCapability;

  // ── display settings driven by props ────────────────────────────────────
  useEffect(() => {
    if (twoPageMode !== undefined) stage.setSpread(twoPageMode ? "odd" : "none");
  }, [stage, twoPageMode]);
  useEffect(() => {
    if (scrollStrategy !== undefined) stage.setLayout(scrollStrategy === ScrollStrategy.Horizontal ? "horizontal" : "vertical");
  }, [stage, scrollStrategy]);

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  useEffect(() => {
    let last = stage.currentPage();
    return kernel.subscribe(() => {
      const now = stage.currentPage();
      if (now === last) return;
      last = now;
      onPageChangeRef.current?.(now + 1);
    });
  }, [kernel, stage]);

  const onDocumentLoadRef = useRef(onDocumentLoad);
  onDocumentLoadRef.current = onDocumentLoad;
  useEffect(() => {
    onDocumentLoadRef.current?.({
      totalPages: stage.pageCount(),
      currentPage: stage.currentPage() + 1,
    });
  }, [kernel, stage, documentId]);

  // ── annotations ─────────────────────────────────────────────────────────
  const hub = useMemo(() => new AnnotationHub(kernel, documentId), [kernel, documentId]);
  useEffect(() => {
    hub.start().catch((error) => console.error("[PDFViewer] annotations failed to start:", error));
    return () => hub.dispose();
  }, [hub]);

  // ── forms ───────────────────────────────────────────────────────────────
  const onFormStateChangeRef = useRef(onFormStateChange);
  onFormStateChangeRef.current = onFormStateChange;
  const onFormFieldSelectRef = useRef(onFormFieldSelect);
  onFormFieldSelectRef.current = onFormFieldSelect;
  const designingRef = useRef(enableFormDesign);
  designingRef.current = enableFormDesign;
  const forms = useMemo(
    () =>
      new FormsController(kernel, documentId, hub, {
        onFormStateChange: (state) => onFormStateChangeRef.current?.(state),
        onFormFieldSelect: (field) => onFormFieldSelectRef.current?.(field),
        isDesigning: () => designingRef.current,
        password: () => password.current,
      }),
    [kernel, documentId, hub, password],
  );
  useEffect(() => {
    forms.start();
    return () => forms.dispose();
  }, [forms]);
  // Design mode swaps the pointer for a tool that edits fields instead of filling them;
  // leaving it also disarms a field tool that was left armed.
  useEffect(() => {
    if (enableFormDesign) forms.enterDesign();
    else forms.exitDesign();
  }, [enableFormDesign, forms]);

  const lockRef = useRef<LockMode>({ type: LockModeType.None });
  const [locked, setLocked] = useState(false);
  const onLockChange = useCallback(() => setLocked(lockRef.current.type === LockModeType.All), []);

  const clickHandlerRef = useRef<((c: ClickToPlaceData) => void) | null>(null);
  const [placing, setPlacing] = useState(false);
  const clickToPlace = useMemo(
    () => ({
      get current() {
        return clickHandlerRef.current;
      },
      set current(value: ((c: ClickToPlaceData) => void) | null) {
        clickHandlerRef.current = value;
        setPlacing(!!value);
      },
    }),
    [],
  );

  const denyEditsRef = useRef(denyAnnotationEdits);
  denyEditsRef.current = denyAnnotationEdits;

  const userInfoRef = useRef<{ author?: string; customData?: any } | null>(null);
  useEffect(() => {
    userInfoRef.current = userDetails
      ? { author: userDetails.name || userDetails.email || "Guest", customData: userDetails }
      : null;
  }, [userDetails]);

  const api = useMemo<PDFViewerRef>(
    () => ({
      ...createDocumentApi({ kernel, stage, documentId, pdfBuffer }),
      selection: createSelectionApi(kernel, documentId),
      search: createSearchApi(kernel, documentId),
      annotation: createAnnotationApi({
        kernel,
        documentId,
        hub,
        lock: lockRef,
        onLockChange,
        clickToPlace,
        denyEdits: () => denyEditsRef.current,
        refresh: () => undefined,
        userInfo: userInfoRef,
      }),
      forms: createFormsApi(forms),
    }),
    [kernel, stage, documentId, pdfBuffer, hub, forms, onLockChange, clickToPlace],
  );
  useImperativeHandle(ref, () => api, [api]);

  return (
    <Stage
      style={{ width: "100%", height: "100%", backgroundColor: "#eeeeee" }}
      overlay={denyAnnotationEdits ? undefined : <AnnotationDeleteMenu hub={hub} />}
    >
      {() => (
        <>
          {/* the annotation layer draws annotations, so the page bitmap leaves them out */}
          <RenderLayer />
          <SelectionLayer />
          <SearchLayer />
          <div style={{ position: "absolute", inset: 0, pointerEvents: locked ? "none" : undefined }}>
            <AnnotationLayer />
          </div>
          <FormFillSurface fillable={enableFormFilling} />
          <ClickToPlaceLayer active={placing} handler={clickHandlerRef} />
        </>
      )}
    </Stage>
  );
});

const PDFViewer = forwardRef<PDFViewerRef, PDFViewerProps>(function PDFViewer(props, ref): ReactElement | null {
  const { className, style } = props;
  return (
    <div className={className} style={{ width: "100%", height: "100%", ...style }}>
      <Viewer
        engine={createEngine}
        plugins={viewerPlugins}
        fallback={props.hideInternalLoading ? null : centered(<div>Loading PDF...</div>)}
        renderError={(error) => centered(<div>Failed to start the PDF viewer: {String((error as Error)?.message ?? error)}</div>)}
      >
        <ViewerBody ref={ref} {...props} />
      </Viewer>
    </div>
  );
});

export { rotationToDegrees, degreesToRotation };
export default PDFViewer;
