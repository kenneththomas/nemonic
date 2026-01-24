export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Memory {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  tags?: string[];
}

export interface Model {
  id: string;
  name: string;
  provider: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    fileName: string;
    chunkIndex: number;
    timestamp: number;
  };
  embedding?: number[];
}

export interface ChatContext {
  messages: Message[];
  selectedMemories: string[];
  selectedDocuments: string[];
  model: string;
}
