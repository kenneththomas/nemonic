import { Message, Memory, DocumentChunk } from '../types';

const STORAGE_KEYS = {
  MESSAGES: 'nemonic_messages',
  MEMORIES: 'nemonic_memories',
  DOCUMENTS: 'nemonic_documents',
  API_KEY: 'nemonic_api_key',
  MODEL: 'nemonic_model',
  SELECTED_MEMORIES: 'nemonic_selected_memories',
  SELECTED_DOCUMENTS: 'nemonic_selected_documents',
  SYSTEM_PROMPT: 'nemonic_system_prompt',
  MODEL_USAGE: 'nemonic_model_usage',
};

export function saveMessages(messages: Message[]): void {
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
}

export function loadMessages(): Message[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading messages:', error);
    return [];
  }
}

export function saveMemories(memories: Memory[]): void {
  localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(memories));
}

export function loadMemories(): Memory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MEMORIES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading memories:', error);
    return [];
  }
}

export function saveDocuments(documents: DocumentChunk[]): void {
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(documents));
}

export function loadDocuments(): DocumentChunk[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading documents:', error);
    return [];
  }
}

export function saveAPIKey(apiKey: string): void {
  localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
}

export function loadAPIKey(): string {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
}

export function saveModel(model: string): void {
  localStorage.setItem(STORAGE_KEYS.MODEL, model);
}

export function loadModel(): string {
  return localStorage.getItem(STORAGE_KEYS.MODEL) || 'openai/gpt-4-turbo';
}

export function saveSelectedMemories(ids: string[]): void {
  localStorage.setItem(STORAGE_KEYS.SELECTED_MEMORIES, JSON.stringify(ids));
}

export function loadSelectedMemories(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SELECTED_MEMORIES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading selected memories:', error);
    return [];
  }
}

export function saveSelectedDocuments(ids: string[]): void {
  localStorage.setItem(STORAGE_KEYS.SELECTED_DOCUMENTS, JSON.stringify(ids));
}

export function loadSelectedDocuments(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SELECTED_DOCUMENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading selected documents:', error);
    return [];
  }
}

export function saveSystemPrompt(prompt: string): void {
  localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, prompt);
}

export function loadSystemPrompt(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || '';
  } catch (error) {
    console.error('Error loading system prompt:', error);
    return '';
  }
}

export interface ModelUsage {
  modelId: string;
  requestCount: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  lastUsed: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

export function trackModelUsage(
  modelId: string, 
  tokens: number,
  promptTokens?: number,
  completionTokens?: number,
  pricing?: { prompt: number; completion: number }
): void {
  try {
    const usageData = loadModelUsage();
    const existing = usageData.find(u => u.modelId === modelId);
    
    if (existing) {
      existing.requestCount += 1;
      existing.totalTokens += tokens;
      if (promptTokens !== undefined) existing.totalPromptTokens += promptTokens;
      if (completionTokens !== undefined) existing.totalCompletionTokens += completionTokens;
      existing.lastUsed = Date.now();
      if (pricing) existing.pricing = pricing;
    } else {
      usageData.push({
        modelId,
        requestCount: 1,
        totalTokens: tokens,
        totalPromptTokens: promptTokens || 0,
        totalCompletionTokens: completionTokens || 0,
        lastUsed: Date.now(),
        pricing,
      });
    }
    
    localStorage.setItem(STORAGE_KEYS.MODEL_USAGE, JSON.stringify(usageData));
  } catch (error) {
    console.error('Error tracking model usage:', error);
  }
}

export function loadModelUsage(): ModelUsage[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MODEL_USAGE);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading model usage:', error);
    return [];
  }
}

export function getModelUsage(modelId: string): ModelUsage | undefined {
  const usage = loadModelUsage();
  return usage.find(u => u.modelId === modelId);
}
