---
"@cannymindstech/pdf-viewer": patch
---

Ship the PDFium worker (`dist/pdfium-worker.js`) minified. It no longer carries the engine's developer comments, which security scanners flagged as "Information Disclosure - Suspicious Comments", and it is about half the size (355 KB instead of 676 KB).
