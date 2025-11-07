# @cannyminds/pdf-viewer

> A React Headless PDF viewer component built with @embedpdf

![Demo Image](https://raw.githubusercontent.com/CannyMinds/PDF-Viewer-Lib/main/packages/pdf-viewer/demo.png)

<br />

## Features

- ✅ **Headless Design** - Full control over UI and styling
- ✅ **Password Protected PDFs** - Built-in support for encrypted PDFs
- ✅ **Annotations** - Add highlights, images/stamps, and manage annotations
- ✅ **TypeScript Support** - Full type definitions included
- ✅ **Modern React** - Uses hooks and modern React patterns
- ✅ **Buffer-based** - Works with ArrayBuffer for flexible data loading
- ✅ **Error Handling** - Comprehensive error reporting


## Installation

```bash
npm install @cannyminds/pdf-viewer
# or
yarn add @cannyminds/pdf-viewer
# or
pnpm add @cannyminds/pdf-viewer
# or
bun add @cannyminds/pdf-viewer
```

The package will automatically install the required @embedpdf dependencies including the PDFium WASM engine.


## Usage

### Basic Usage

```jsx
import { PDFViewer } from '@cannyminds/pdf-viewer';

function App() {
  const [pdfBuffer, setPdfBuffer] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPdfBuffer(e.target.result);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div style={{ height: '100vh' }}>
      <input type="file" accept=".pdf" onChange={handleFileUpload} />
      {pdfBuffer && <PDFViewer pdfBuffer={pdfBuffer} />}
    </div>
  );
}
```

### With Password Support

```jsx
import { PDFViewer } from '@cannyminds/pdf-viewer';

function App() {
  const [pdfBuffer, setPdfBuffer] = useState(null);

  const handlePasswordRequest = async (fileName) => {
    // You can show a modal, prompt, or any UI to get the password
    const password = prompt(`Enter password for ${fileName || 'PDF'}:`);
    return password;
  };

  return (
    <div style={{ height: '100vh' }}>
      <PDFViewer 
        pdfBuffer={pdfBuffer} 
        onPasswordRequest={handlePasswordRequest}
      />
    </div>
  );
}
```

### With Annotations

The PDFViewer component includes built-in annotation support. Use the ref to access annotation methods:

```jsx
import { PDFViewer } from '@cannyminds/pdf-viewer';
import { useRef } from 'react';

function App() {
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const pdfViewerRef = useRef(null);

  const handleActivateHighlighter = () => {
    pdfViewerRef.current?.annotation.activateHighlighter();
  };

  const handleActivateImageTool = () => {
    pdfViewerRef.current?.annotation.activateStamp();
  };

  const handleDeleteSelected = () => {
    const deleted = pdfViewerRef.current?.annotation.deleteSelectedAnnotation();
    if (!deleted) {
      alert('Please select an annotation to delete');
    }
  };

  const handleGetDetails = () => {
    const details = pdfViewerRef.current?.annotation.getSelectedAnnotationDetails();
    if (details) {
      console.log('Annotation ID:', details.id);
      console.log('Type:', details.type);
      console.log('Page:', details.pageIndex);
      console.log('Position:', details.rect.origin); // { x, y }
      console.log('Size:', details.rect.size); // { width, height }
      console.log('Author:', details.author);
    }
  };

  return (
    <div style={{ height: '100vh' }}>
      <button onClick={handleActivateHighlighter}>Highlight</button>
      <button onClick={handleActivateImageTool}>Add Image</button>
      <button onClick={handleDeleteSelected}>Delete</button>
      <button onClick={handleGetDetails}>Get Details</button>
      {pdfBuffer && <PDFViewer ref={pdfViewerRef} pdfBuffer={pdfBuffer} />}
    </div>
  );
}
```

### Using the Hook (Advanced)

For more control, you can use the `usePDFViewer` hook directly:

```jsx
import { usePDFViewer } from '@cannyminds/pdf-viewer';
import { EmbedPDF } from '@embedpdf/core/react';

function CustomPDFViewer({ pdfBuffer }) {
  const { engine, plugins, isLoading, error, isReady, instance } = usePDFViewer({
    pdfBuffer,
  });

  if (isLoading) return <div>Loading PDF...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!isReady) return <div>Preparing PDF...</div>;

  return (
    <div style={{ height: '500px' }}>
      <EmbedPDF engine={engine} plugins={plugins}>
        {/* Your custom PDF rendering logic */}
      </EmbedPDF>
    </div>
  );
}
```

## API Reference

### PDFViewer Component

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `pdfBuffer` | `ArrayBuffer \| null \| undefined` | No | The PDF file as an ArrayBuffer |
| `onPasswordRequest` | `(fileName?: string) => Promise<string \| null>` | No | Callback function to request password for encrypted PDFs |

### usePDFViewer Hook

#### Parameters

```typescript
interface PDFViewerOptions {
  pdfBuffer?: ArrayBuffer | null | undefined;
  password?: string;
}
```

#### Returns

```typescript
interface PDFViewerHookReturn {
  engine: any;
  plugins: any[];
  isLoading: boolean;
  error: PDFError | null;
  isReady: boolean;
  instance: PDFViewerInstance;
}
```

#### Instance Methods

```typescript
interface PDFViewerInstance {
  setPassword: (password: string) => void;
  setZoom: (scale: number) => void;
  getCurrentPage: () => number | null;
  setPage: (page: number) => void;
  getTotalPages: () => number | null;
  setPasswordChecked: (checked: boolean) => void;
  setIsPasswordChecked: (checked: boolean) => void;
}
```

### PDFViewerRef (Imperative Handle)

When using `forwardRef`, you get access to these methods:

```typescript
interface PDFViewerRef {
  zoom: {
    zoomIn: () => void;
    zoomOut: () => void;
    setZoom: (level: number) => void;
    resetZoom: () => void;
    getZoom: () => number | ZoomMode;
  };
  search: {
    searchText: (keyword: string) => Promise<SearchAllPagesResult | null>;
    nextResult: () => number;
    previousResult: () => number;
    goToResult: (index: number) => number;
    stopSearch: () => void;
    startSearch: () => void;
    getSearchState: () => SearchState | null;
    setShowAllResults: (show: boolean) => void;
  };
  rotate: {
    rotateForward: () => void;
    rotateBackward: () => void;
    setRotation: (rotation: Rotation) => void;
    getRotation: () => Rotation;
  };
  annotation: {
    activateHighlighter: () => void;
    deactivateHighlighter: () => void;
    isHighlighterActive: () => boolean;
    activateStamp: () => void;
    deactivateStamp: () => void;
    isStampActive: () => boolean;
    deleteSelectedAnnotation: () => boolean;
    getSelectedAnnotation: () => any;
    getSelectedAnnotationDetails: () => PdfAnnotationObject | null;
    onAnnotationEvent: (callback: (event: AnnotationEvent) => void) => (() => void) | null;
  };
}
```

**Note:** Navigation (goToPage, getCurrentPage, getTotalPages) and text selection methods (clearSelection, getSelectedText) are not yet implemented.

### Annotation API

#### Annotation Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `activateHighlighter()` | Activates the text highlighter tool | `void` |
| `deactivateHighlighter()` | Deactivates the highlighter | `void` |
| `isHighlighterActive()` | Checks if highlighter is active | `boolean` |
| `activateStamp()` | Activates the image/stamp tool (opens file picker on click) | `void` |
| `deactivateStamp()` | Deactivates the stamp tool | `void` |
| `isStampActive()` | Checks if stamp tool is active | `boolean` |
| `deleteSelectedAnnotation()` | Deletes the currently selected annotation | `boolean` |
| `getSelectedAnnotation()` | Gets the selected annotation wrapper | `TrackedAnnotation \| null` |
| `getSelectedAnnotationDetails()` | Gets the selected annotation full details | `PdfAnnotationObject \| null` |
| `onAnnotationEvent(callback)` | Subscribes to annotation events | `unsubscribe function` |

#### Annotation Data Structure

```typescript
interface PdfAnnotationObject {
  id: string;                    // UUID v4 identifier
  type: number;                  // Annotation type (8=Highlight, 13=Stamp, etc.)
  pageIndex: number;             // Zero-based page number
  rect: {                        // Position and dimensions
    origin: { x: number; y: number };     // Top-left position
    size: { width: number; height: number }; // Dimensions
  };
  author?: string;               // Creator name
  created?: Date;                // Creation timestamp
  modified?: Date;               // Last modification timestamp
  contents?: string;             // Annotation content/comment
  color?: string;                // Color (for highlights)
  opacity?: number;              // Opacity 0.0-1.0
  custom?: any;                  // Custom JSON data
}
```

#### Getting Annotation Details

```javascript
const details = pdfViewerRef.current.annotation.getSelectedAnnotationDetails();

if (details) {
  // Basic info
  console.log('ID:', details.id);
  console.log('Type:', details.type);
  console.log('Page:', details.pageIndex);

  // Position and size
  const x = details.rect.origin.x;
  const y = details.rect.origin.y;
  const width = details.rect.size.width;
  const height = details.rect.size.height;

  // Metadata
  console.log('Author:', details.author);
  console.log('Created:', details.created);
}
```

#### Listening to Annotation Events

```javascript
useEffect(() => {
  if (pdfViewerRef.current) {
    const unsubscribe = pdfViewerRef.current.annotation.onAnnotationEvent((event) => {
      console.log('Event type:', event.type); // 'create', 'update', 'delete', 'loaded'
      console.log('Annotation:', event.annotation);
      console.log('Page:', event.pageIndex);
      console.log('Committed:', event.committed);

      // Save to backend when annotation is created
      if (event.type === 'create' && event.committed) {
        saveAnnotationToBackend(event.annotation);
      }
    });

    return () => unsubscribe && unsubscribe();
  }
}, []);
```

#### Annotation Types Reference

| Type ID | Annotation Type | Description |
|---------|----------------|-------------|
| 8 | Highlight | Text highlighting |
| 9 | Underline | Text underline |
| 10 | Squiggly | Wavy underline |
| 11 | StrikeOut | Text strikethrough |
| 13 | Stamp | Image/stamp annotation |
| 14 | Ink | Freehand drawing |
| 15 | FreeText | Text box |
| 4 | Square | Rectangle shape |
| 5 | Circle | Ellipse shape |
| 6 | Line | Straight line |

#### Keyboard Shortcuts

When an annotation is selected:
- **Delete** or **Backspace** - Delete the selected annotation

### Error Types

```typescript
enum PDFErrorType {
  ENGINE = 'ENGINE',
  VALIDATION = 'VALIDATION',
  LOADING = 'LOADING'
}

interface PDFError {
  type: PDFErrorType;
  message: string;
  originalError?: any;
}
```

## Styling

This is a headless component, so you have full control over styling. The default viewer includes basic styling, but you can completely customize the appearance by using the `usePDFViewer` hook and building your own UI.

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

If you encounter any issues or have questions, please file an issue on the [GitHub repository](https://github.com/CannyMinds/PDF-Viewer-Lib/issues).