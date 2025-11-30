import React, { useEffect, useRef, useState, useCallback } from 'react';
import { UploadedImage, Rect } from '../types';

interface EditorCanvasProps {
  image: UploadedImage | null;
  onCrop: (croppedImage: UploadedImage) => void;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ image, onCrop }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Load image when prop changes
  useEffect(() => {
    if (!image) {
      setImgElement(null);
      setSelection(null);
      return;
    }

    const img = new Image();
    img.src = image.url;
    img.onload = () => {
      setImgElement(img);
      setSelection(null); // Reset selection on new image
    };
  }, [image]);

  // Draw image and selection overlay
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElement || !containerRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive sizing: fit within container while maintaining aspect ratio
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = 500; // Fixed max height for the editor area
    
    const scale = Math.min(containerWidth / imgElement.width, containerHeight / imgElement.height);
    const displayWidth = imgElement.width * scale;
    const displayHeight = imgElement.height * scale;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Draw Image
    ctx.drawImage(imgElement, 0, 0, displayWidth, displayHeight);

    // Draw Selection
    if (selection) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;

      ctx.fillRect(selection.x, selection.y, selection.width, selection.height);
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
    }
  }, [imgElement, selection]);

  useEffect(() => {
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [draw]);

  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgElement) return;
    setIsDragging(true);
    const pos = getMousePos(e);
    setStartPos(pos);
    setSelection({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selection) return;
    const currentPos = getMousePos(e);
    
    const width = currentPos.x - startPos.x;
    const height = currentPos.y - startPos.y;

    setSelection({
      x: width < 0 ? currentPos.x : startPos.x,
      y: height < 0 ? currentPos.y : startPos.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    if (!imgElement || !selection || !canvasRef.current) return;
    if (selection.width < 10 || selection.height < 10) return; // Ignore tiny crops

    // Calculate actual scale ratio
    const scaleX = imgElement.width / canvasRef.current.width;
    const scaleY = imgElement.height / canvasRef.current.height;

    const sourceX = selection.x * scaleX;
    const sourceY = selection.y * scaleY;
    const sourceW = selection.width * scaleX;
    const sourceH = selection.height * scaleY;

    // Create offscreen canvas for cropping
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sourceW;
    cropCanvas.height = sourceH;
    const cropCtx = cropCanvas.getContext('2d');

    if (cropCtx) {
      cropCtx.drawImage(
        imgElement,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        0,
        0,
        sourceW,
        sourceH
      );

      // Convert to blob/base64
      const base64 = cropCanvas.toDataURL(image!.mimeType);
      
      const newImage: UploadedImage = {
        id: Date.now().toString(),
        name: `Crop_${image!.name}`,
        mimeType: image!.mimeType,
        base64: base64.split(',')[1],
        url: base64,
      };

      onCrop(newImage);
      setSelection(null);
    }
  };

  if (!image) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-900 rounded-lg border border-gray-700 text-gray-500">
        Select an image to view or crop
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div 
        ref={containerRef} 
        className="relative w-full bg-black rounded-lg overflow-hidden flex justify-center items-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"
        style={{ minHeight: '500px' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair shadow-2xl"
        />
      </div>
      
      <div className="flex justify-between items-center bg-gray-800 p-2 rounded-lg">
         <span className="text-xs text-gray-400">
           Drag on image to select area
         </span>
         {selection && selection.width > 10 && (
          <button
            onClick={handleCrop}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
          >
            Crop Selection as New Image
          </button>
        )}
      </div>
    </div>
  );
};