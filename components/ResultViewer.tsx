import React, { useState, useRef, useEffect } from 'react';

interface ResultViewerProps {
  imageUrl: string | null;
  onClose: () => void;
  onSave?: () => void;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({ imageUrl, onClose, onSave }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      // Reset zoom on new image
      setScale(1);
      setPosition({ x: 0, y: 0 });
  }, [imageUrl]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); // Stop page scroll
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.5, scale + scaleAmount), 5);
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="relative w-full h-full max-w-6xl flex flex-col">
        {/* Toolbar */}
        <div className="flex justify-between items-center mb-4 p-4 bg-gray-800 rounded-lg shadow-lg z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Generated Result</h2>
            <div className="flex items-center gap-2 bg-gray-700 rounded px-2 py-1">
                <button className="text-gray-300 hover:text-white px-2" onClick={() => setScale(s => Math.max(0.5, s - 0.5))}>-</button>
                <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
                <button className="text-gray-300 hover:text-white px-2" onClick={() => setScale(s => Math.min(5, s + 0.5))}>+</button>
            </div>
            <button 
                onClick={() => { setScale(1); setPosition({x:0, y:0}); }}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
                Reset View
            </button>
          </div>
          
          <div className="flex gap-3">
             {onSave && (
                <button
                    onClick={onSave}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Add to Library
                </button>
            )}
            <a 
                href={imageUrl} 
                download={`gemini_edit_${Date.now()}.png`}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium text-sm transition-colors"
            >
                Download
            </a>
            <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 rounded font-medium text-sm transition-colors"
            >
                Close
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div 
            ref={containerRef}
            className="flex-1 overflow-hidden bg-[#0a0a0a] rounded-lg border border-gray-800 relative cursor-move flex items-center justify-center"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    transformOrigin: 'center',
                }}
            >
                <img 
                    src={imageUrl} 
                    alt="Generated Content" 
                    className="max-w-none shadow-2xl pointer-events-none select-none"
                    style={{ maxHeight: '80vh' }}
                />
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none bg-black/50 px-3 py-1 rounded text-xs text-gray-400">
                Scroll to zoom • Drag to pan
            </div>
        </div>
      </div>
    </div>
  );
};