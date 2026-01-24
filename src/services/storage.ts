import { Message, Memory, DocumentChunk } from '../types';

const STORAGE_KEYS = {
  MESSAGES: 'nemonic_messages',
  MEMORIES: 'nemonic_memories',
  DOCUMENTS: 'nemonic_documents',
  API_KEY: 'nemonic_api_key',
  MODEL: 'nemonic_model',
  SELECTED_MEMORIES: 'nemonic_selected_memories',
  SELECTED_DOCUMENTS: 'nemonic_selected_documents',
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
