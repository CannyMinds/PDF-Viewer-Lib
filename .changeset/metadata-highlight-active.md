---
"@cannymindstech/pdf-viewer": patch
---

Highlights:
- `ref.highlight` API (like `ref.annotation`): `add` (returns ids), `remove`, `clear`, `focus` and `list`. Boxes added from code are drawn together with the `highlights` prop's boxes.
- A box can have an `id` and a `color`, and can be marked `active`: drawn in blue on top of the others and scrolled into view when it becomes active or is focused. Boxes that are not active no longer move the view (0.10.0 scrolled to the first box whenever the set changed).
