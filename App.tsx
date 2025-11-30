import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { EditorCanvas } from './components/EditorCanvas';
import { ResultViewer } from './components/ResultViewer';
import { generateImageEdit } from './services/gemini';
import { UploadedImage, AppStatus } from './types';

// Utility to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// History Hook
function useHistory<T>(initialState: T) {
  const [history, setHistory] = useState<{
    past: T[];
    present: T;
    future: T[];
  }>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    setHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const set = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory(curr => {
      const resolvedState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(curr.present) 
        : newState;
      
      return {
        past: [...curr.past, curr.present],
        present: resolvedState,
        future: [],
      };
    });
  }, []);

  return { state: history.present, set, undo, redo, canUndo, canRedo };
}

const App: React.FC = () => {
  // Use history hook for images
  const { 
    state: images, 
    set: setImages, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<UploadedImage[]>([]);

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedForProcessing, setSelectedForProcessing] = useState<Set<string>>(new Set());
  
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);

  // Sync selections with history changes
  useEffect(() => {
    // Cleanup selection if image no longer exists (e.g. after undo)
    if (selectedImageId && !images.find(img => img.id === selectedImageId)) {
        // Try to select the first image if available, or null
        setSelectedImageId(images.length > 0 ? images[0].id : null);
    }
    
    // Cleanup processing set
    setSelectedForProcessing(prev => {
        const next = new Set(prev);
        let changed = false;
        // Remove IDs that are no longer in the image list
        Array.from(prev).forEach(id => {
            if (!images.find(img => img.id === id)) {
                next.delete(id);
                changed = true;
            }
        });
        return changed ? next : prev;
    });
  }, [images, selectedImageId]);

  const handleImagesUploaded = async (files: File[]) => {
    const newImages: UploadedImage[] = [];
    
    for (const file of files) {
      try {
        const base64Url = await fileToBase64(file);
        // Extract raw base64 without prefix
        const base64Data = base64Url.split(',')[1];
        
        const newImg: UploadedImage = {
          id: Date.now().toString() + Math.random().toString(),
          url: base64Url,
          base64: base64Data,
          mimeType: file.type,
          name: file.name
        };
        newImages.push(newImg);
      } catch (err) {
        console.error("Error processing file", file.name, err);
      }
    }

    setImages(prev => [...prev, ...newImages]);
    
    // Auto select first uploaded if none selected
    if (!selectedImageId && newImages.length > 0) {
      setSelectedImageId(newImages[0].id);
      setSelectedForProcessing(prev => new Set(prev).add(newImages[0].id));
    }
  };

  const handleCrop = (croppedImage: UploadedImage) => {
    setImages(prev => [croppedImage, ...prev]);
    setSelectedImageId(croppedImage.id);
    setSelectedForProcessing(prev => {
        const newSet = new Set(prev);
        newSet.add(croppedImage.id);
        return newSet;
    });
  };

  const toggleProcessingSelection = (id: string) => {
    setSelectedForProcessing(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  const handleGenerate = async () => {
    if (selectedForProcessing.size === 0) {
      setErrorMessage("Please select at least one image to edit/synthesize.");
      return;
    }
    if (!prompt.trim()) {
      setErrorMessage("Please enter a prompt describing the desired changes.");
      return;
    }

    setStatus(AppStatus.GENERATING);
    setErrorMessage(null);

    const sourceImages = images.filter(img => selectedForProcessing.has(img.id));

    try {
      const resultUrl = await generateImageEdit(prompt, sourceImages);
      setResultImage(resultUrl);
      setStatus(AppStatus.SUCCESS);
    } catch (e: any) {
      setErrorMessage(e.message || "An unknown error occurred.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleSaveResult = (imageUrl: string) => {
    const newImg: UploadedImage = {
        id: Date.now().toString(),
        url: imageUrl,
        base64: imageUrl.split(',')[1],
        mimeType: 'image/png',
        name: `Gen_${new Date().toLocaleTimeString().replace(/:/g, '')}.png`
    };
    setImages(prev => [newImg, ...prev]);
    setResultImage(null);
    // Select the new generated image
    setSelectedImageId(newImg.id);
  };

  const getActiveImage = () => images.find(img => img.id === selectedImageId) || null;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-blue-500 selection:text-white pb-20">
      
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg"></div>
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Gemini Image Studio</h1>
            </div>
            
            {/* Toolbar */}
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1 border border-gray-700">
                <button
                    onClick={undo}
                    disabled={!canUndo}
                    className={`p-2 rounded hover:bg-gray-700 transition-colors ${!canUndo ? 'opacity-30 cursor-not-allowed' : 'text-gray-200'}`}
                    title="Undo (Ctrl+Z)"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                </button>
                <div className="w-px h-6 bg-gray-700"></div>
                <button
                    onClick={redo}
                    disabled={!canRedo}
                    className={`p-2 rounded hover:bg-gray-700 transition-colors ${!canRedo ? 'opacity-30 cursor-not-allowed' : 'text-gray-200'}`}
                    title="Redo (Ctrl+Y)"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                </button>
            </div>

            <div className="text-xs text-gray-500 font-mono hidden sm:block">
                Powered by Gemini 2.5 Flash
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Editor & Input */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Workbench Area */}
            <div className="bg-gray-800 rounded-xl p-1 shadow-2xl border border-gray-700">
                <div className="bg-gray-900 rounded-lg p-4">
                    <EditorCanvas 
                        image={getActiveImage()} 
                        onCrop={handleCrop} 
                    />
                </div>
            </div>

            {/* Prompt Input */}
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-gray-300">Prompt Instructions</label>
                    <span className="text-xs text-gray-500">{selectedForProcessing.size} images selected for context</span>
                </div>
                <textarea
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all placeholder-gray-600"
                    rows={3}
                    placeholder="Describe how to edit, merge, or synthesize the selected images... (e.g., 'Place the cropped object onto the landscape image', 'Turn this sketch into a realistic photo')"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
                
                {errorMessage && (
                    <div className="p-3 bg-red-900/30 border border-red-800 rounded text-red-300 text-sm">
                        {errorMessage}
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={handleGenerate}
                        disabled={status === AppStatus.GENERATING}
                        className={`
                            px-8 py-3 rounded-lg font-bold text-sm tracking-wide transition-all shadow-lg
                            ${status === AppStatus.GENERATING 
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:shadow-blue-500/25'}
                        `}
                    >
                        {status === AppStatus.GENERATING ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : 'Generate Content'}
                    </button>
                </div>
            </div>
        </div>

        {/* Right Column: Assets */}
        <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 min-h-[400px]">
                <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider flex justify-between items-center">
                    Asset Library
                    <span className="text-xs normal-case text-gray-500 font-normal">{images.length} items</span>
                </h3>
                
                <ImageUploader onImagesUploaded={handleImagesUploaded} />

                <div className="mt-6 flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {images.length === 0 && (
                        <p className="text-gray-500 text-center text-sm py-8 italic">No images uploaded yet.</p>
                    )}
                    
                    {images.map((img) => (
                        <div 
                            key={img.id}
                            onClick={() => setSelectedImageId(img.id)}
                            className={`
                                group relative flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border
                                ${selectedImageId === img.id ? 'bg-gray-700 border-blue-500' : 'bg-gray-900/50 border-gray-800 hover:bg-gray-700 hover:border-gray-600'}
                            `}
                        >
                            <img src={img.url} alt={img.name} className="w-16 h-16 object-cover rounded bg-black" />
                            
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-300 truncate">{img.name}</p>
                                <p className="text-[10px] text-gray-500 mt-1">{img.mimeType}</p>
                            </div>

                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProcessingSelection(img.id);
                                }}
                                className={`
                                    w-6 h-6 rounded flex items-center justify-center border transition-all
                                    ${selectedForProcessing.has(img.id) 
                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                        : 'bg-transparent border-gray-600 text-transparent hover:border-gray-400'}
                                `}
                                title="Include in Generation"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-xs text-gray-400">
                <h4 className="font-semibold text-gray-300 mb-2">Instructions</h4>
                <ul className="list-disc pl-4 space-y-1">
                    <li>Upload images to the library.</li>
                    <li>Click an image to view it in the Editor.</li>
                    <li>Drag on the Editor to <strong>Crop</strong> specific content.</li>
                    <li>Select images using the checkbox to use them as input.</li>
                    <li>Use <strong>Undo/Redo</strong> to revert changes to your asset library.</li>
                </ul>
            </div>
        </div>

      </main>

      {/* Result Modal */}
      {resultImage && (
        <ResultViewer 
            imageUrl={resultImage} 
            onClose={() => setResultImage(null)}
            onSave={() => handleSaveResult(resultImage)}
        />
      )}

    </div>
  );
};

export default App;