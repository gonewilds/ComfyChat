export interface Settings {
  id?: number;
  apiHost: string; // e.g., "127.0.0.1:8188"
  workflowJson: string; // The raw JSON string
  authToken?: string; // Vast.ai Bearer token
}

export interface ChatMessage {
  id?: number; // IndexedDB auto-increment
  role: 'user' | 'bot';
  content: string; // Text prompt or status message
  imageUrl?: string; // If it's a generated image
  imageBlob?: Blob; // For permanent storage if needed
  timestamp: number;
  originalPrompt?: string; // To "Generate More"
  status?: 'pending' | 'loading' | 'complete' | 'error';
}

export interface FavoriteItem {
  id?: number;
  prompt: string;
  imageBlob: Blob;
  timestamp: number;
}

export type ViewMode = 'chat' | 'gallery' | 'settings';

export interface ComfyNode {
  inputs: Record<string, any>;
  class_type: string;
  _meta?: any;
}

export type ComfyWorkflow = Record<string, ComfyNode>;