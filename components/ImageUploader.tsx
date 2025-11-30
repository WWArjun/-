import React, { ChangeEvent } from 'react';

interface ImageUploaderProps {
  onImagesUploaded: (files: File[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesUploaded }) => {
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      onImagesUploaded(fileArray);
      // Reset input value to allow re-uploading the same file if needed
      e.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <label
        htmlFor="image-upload"
        className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-400">
          <svg
            className="w-8 h-8 mb-3"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 16"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
            />
          </svg>
          <p className="mb-2 text-sm text-center">
            <span className="font-semibold">Click to upload</span>
          </p>
          <p className="text-xs text-center">PNG, JPG (MAX 5MB)</p>
        </div>
        <input
          id="image-upload"
          type="file"
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          multiple
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
};