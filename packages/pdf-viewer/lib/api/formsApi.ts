import type { FormsController } from "../forms/controller";
import type { PDFViewerRef } from "../types/public";

export const createFormsApi = (controller: FormsController): PDFViewerRef["forms"] => ({
  getFormState: () => controller.getState(),
  getFormFields: () => controller.getFormFields() as any,
  getFormValues: () => controller.getFormValues(),
  setFormValues: (values) => controller.setFormValues(values),
  getFilledPdf: async () => {
    try {
      return await controller.getFilledPdf();
    } catch (error) {
      console.error("[PDFViewer] getFilledPdf failed:", error);
      return null;
    }
  },
  markFormSaved: () => controller.markSaved(),
  activateFieldTool: (type) => controller.activateTool(type),
  deactivateFieldTool: () => controller.deactivateTool(),
  getActiveFieldTool: () => controller.getActiveTool(),
  getSelectedField: () => controller.getSelectedField(),
  updateField: (annotationId, changes) => controller.updateField(annotationId, changes),
  renameField: (annotationId, name) => controller.renameField(annotationId, name),
  shareField: (annotationId, targetAnnotationId) => controller.shareField(annotationId, targetAnnotationId),
  deleteField: (annotationId) => controller.deleteField(annotationId),
});
