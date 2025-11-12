/**
 * Convert SVG string to data URL
 */
export const svgToDataUrl = (svgString: string): string => {
  const encodedSvg = encodeURIComponent(svgString);
  return `data:image/svg+xml,${encodedSvg}`;
};

/**
 * Convert SVG to PNG data URL for better PDF compatibility
 */
export const svgToPngDataUrl = (svgString: string, width: number = 200, height: number = 100): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    canvas.width = width;
    canvas.height = height;
    
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Canvas context not available'));
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load SVG'));
    img.src = svgToDataUrl(svgString);
  });
};

/**
 * Create SVG signature from canvas drawing
 */
export const canvasToSvg = (canvas: HTMLCanvasElement): string => {
  const paths: string[] = [];
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // This is a simplified version - you'd need a more sophisticated
  // path tracking system for real canvas-to-SVG conversion
  const svg = `
    <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="transparent"/>
      <!-- Canvas drawing would be converted to SVG paths here -->
    </svg>
  `;
  
  return svg.trim();
};