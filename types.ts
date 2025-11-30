export interface UploadedImage {
  id: string;
  url: string; // Blob URL for display
  base64: string; // For API
  mimeType: string;
  name: string;
}

export interface GenerationResult {
  imageUrl: string; // Data URL
  timestamp: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}