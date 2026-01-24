import { Message, Memory, DocumentChunk, Conversation } from '../types';

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
  CONVERSATIONS: 'nemonic_conversations',
  ACTIVE_CONVERSATION_ID: 'nemonic_active_conversation_id',
  CONVERSATION_MESSAGES: 'nemonic_conversation_messages',
  THEME: 'nemonic_theme',
  LLM_SETTINGS: 'nemonic_llm_settings',
};

export type ThemeId = 'default' | 'ios';

export function loadTheme(): ThemeId {
  const t = localStorage.getItem(STORAGE_KEYS.THEME);
  if (t === 'ios' || t === 'default') return t;
  return 'default';
}

export function saveTheme(theme: ThemeId): void {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

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

/** Increment useCount for each memory whose id is in `ids`. Call when user sends a message with those memories selected. */
export function incrementMemoryUseCount(ids: string[]): void {
  if (ids.length === 0) return;
  const memories = loadMemories();
  let changed = false;
  for (const m of memories) {
    if (ids.includes(m.id)) {
      m.useCount = (m.useCount ?? 0) + 1;
      changed = true;
    }
  }
  if (changed) saveMemories(memories);
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

export interface LLMSettings {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_messages?: number;
}

export function saveLLMSettings(settings: LLMSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LLM_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving LLM settings:', error);
  }
}

export function loadLLMSettings(): LLMSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LLM_SETTINGS);
    if (data) {
      return JSON.parse(data);
    }
    // Return defaults
    return {
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      max_messages: 10,
    };
  } catch (error) {
    console.error('Error loading LLM settings:', error);
    return {
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      max_messages: 10,
    };
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

// --- Conversation management ---

export function loadConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading conversations:', error);
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
}

export function loadConversationMessages(): Record<string, Message[]> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONVERSATION_MESSAGES);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading conversation messages:', error);
    return {};
  }
}

export function saveConversationMessages(messagesByConv: Record<string, Message[]>): void {
  localStorage.setItem(STORAGE_KEYS.CONVERSATION_MESSAGES, JSON.stringify(messagesByConv));
}

export function loadMessagesForConversation(conversationId: string): Message[] {
  const all = loadConversationMessages();
  return all[conversationId] ?? [];
}

export function saveMessagesForConversation(conversationId: string, messages: Message[]): void {
  const all = loadConversationMessages();
  all[conversationId] = messages;
  saveConversationMessages(all);
}

export function getActiveConversationId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
}

export function setActiveConversationId(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
  } else {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID, id);
  }
}

export function createConversation(): Conversation {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const conv: Conversation = {
    id,
    title: 'New conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const list = loadConversations();
  list.unshift(conv);
  saveConversations(list);
  setActiveConversationId(id);
  return conv;
}

export function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, 'title' | 'updatedAt'>>
): void {
  const list = loadConversations();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...updates };
  saveConversations(list);
}

export function deleteConversation(id: string): void {
  const list = loadConversations().filter(c => c.id !== id);
  saveConversations(list);
  const all = loadConversationMessages();
  delete all[id];
  saveConversationMessages(all);
  const active = getActiveConversationId();
  if (active === id) {
    setActiveConversationId(list[0]?.id ?? null);
  }
}

/** Ensure at least one conversation exists; migrate legacy messages if present. Call once on app init. */
export function ensureConversationsInitialized(): void {
  const conversations = loadConversations();
  if (conversations.length > 0) return;

  const legacy = loadMessages();
  const conv = createConversation();
  if (legacy.length > 0) {
    updateConversation(conv.id, { title: 'Migrated chat' });
    saveMessagesForConversation(conv.id, legacy);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  }
}
