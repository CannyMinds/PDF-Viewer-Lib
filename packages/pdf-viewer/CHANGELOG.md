# @cannymindstech/pdf-viewer

## 0.10.1

### Patch Changes

- 207cc0d: Highlights:
  - `ref.highlight` API (like `ref.annotation`): `add` (returns ids), `remove`, `clear`, `focus` and `list`. Boxes added from code are drawn together with the `highlights` prop's boxes.
  - A box can have an `id` and a `color`, and can be marked `active`: drawn in blue on top of the others and scrolled into view when it becomes active or is focused. Boxes that are not active no longer move the view (0.10.0 scrolled to the first box whenever the set changed).

## 0.10.0

### Minor Changes

- 32a2ca3: New `highlights` prop: draws boxes over pages (page number plus a box as fractions of the page, with an optional label) and scrolls the first one into view whenever the set changes. Boxes follow zoom and rotation.

## 0.9.4

### Patch Changes

- 5812fbc: Ship the PDFium worker (`dist/pdfium-worker.js`) minified. It no longer carries the engine's developer comments, which security scanners flagged as "Information Disclosure - Suspicious Comments", and it is about half the size (355 KB instead of 676 KB).

## 0.9.3

### Patch Changes

- 3a4df3f: Set up Changesets-based package releases with automated versioning, changelogs, and npm trusted publishing.
