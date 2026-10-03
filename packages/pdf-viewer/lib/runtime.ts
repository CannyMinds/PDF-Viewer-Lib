import { interactionPlugin, renderPlugin, stagePlugin } from "@embedpdf/react";
import { searchPlugin } from "@embedpdf/plugin-search";
import { selectionPlugin } from "@embedpdf/plugin-selection";
import type { AnyPlugin } from "@embedpdf/core";
import { annotationPlugin } from "@embedpdf/plugin-annotation";
import { formPlugin } from "@embedpdf/plugin-form";
import { localEngine } from "@embedpdf/engine";
import { bridgePlugin } from "./bridge";
import { ZoomMode } from "./compat";

// <Viewer> captures the engine and plugin list once, so their identity must
// never change between renders: they live at module level.
export const createEngine = () => localEngine();

export const viewerPlugins: AnyPlugin[] = [
  stagePlugin({ layout: "vertical", zoom: { mode: ZoomMode.FitPage }, padding: 10 }),
  renderPlugin(),
  interactionPlugin({ defaultTool: "pointer" }),
  selectionPlugin(),
  searchPlugin({ reveal: { anchor: { y: 0.35 }, behavior: "smooth" } }),
  // Stamps and notes are not rotatable (as in 2.x): the selection frame has no rotate knob.
  annotationPlugin({ chrome: { knob: { size: 0, hitSize: 0, offset: 0, stalk: false } } }),
  formPlugin(),
  bridgePlugin(),
];

// The thumbnail sidebar renders pages in its own, lighter instance.
export const thumbnailPlugins: AnyPlugin[] = [stagePlugin(), renderPlugin()];
