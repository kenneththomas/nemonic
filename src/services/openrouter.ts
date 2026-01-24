export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterStreamChunk {
  id: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function chatWithOpenRouter(
  apiKey: string,
  request: OpenRouterRequest
): Promise<OpenRouterResponse> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Nemonic Chat',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  return response.json();
}

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onComplete: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => void;
  onError?: (error: Error) => void;
}

export async function chatWithOpenRouterStream(
  apiKey: string,
  request: OpenRouterRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Nemonic Chat',
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok) {
    const error = await response.text();
    const errorObj = new Error(`OpenRouter API error: ${error}`);
    callbacks.onError?.(errorObj);
    throw errorObj;
  }

  if (!response.body) {
    const error = new Error('Response body is null');
    callbacks.onError?.(error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;
  let seenDone = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        
        // Skip SSE comments (like ": OPENROUTER PROCESSING")
        if (line.startsWith(':')) {
          continue;
        }
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            seenDone = true;
            break;
          }

          try {
            const chunk: OpenRouterStreamChunk = JSON.parse(data);
            
            // Extract content delta
            const contentDelta = chunk.choices[0]?.delta?.content;
            if (contentDelta) {
              callbacks.onChunk(contentDelta);
            }

            // Extract usage - it comes in the final chunk before [DONE]
            if (chunk.usage) {
              finalUsage = chunk.usage;
              console.log('Usage data received:', chunk.usage);
            }
          } catch (e) {
            // Skip invalid JSON lines
            console.warn('Failed to parse SSE chunk:', data, e);
          }
        }
      }

      // Exit when we see [DONE]
      if (seenDone) {
        break;
      }
    }

    // Handle any remaining buffer
    if (buffer.trim() && buffer.startsWith('data: ')) {
      const data = buffer.slice(6);
      if (data !== '[DONE]') {
        try {
          const chunk: OpenRouterStreamChunk = JSON.parse(data);
          if (chunk.usage) {
            finalUsage = chunk.usage;
          }
        } catch (e) {
          // Ignore parse errors for final buffer
        }
      }
    }

    // Always call onComplete with usage data
    if (finalUsage) {
      callbacks.onComplete(finalUsage);
    } else {
      // If no usage data was found, log a warning and call with zeros
      console.warn('No usage data found in streaming response');
      callbacks.onComplete({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown streaming error');
    callbacks.onError?.(err);
    throw err;
  } finally {
    reader.releaseLock();
  }
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  context_length?: number;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
}

export async function getModels(apiKey?: string): Promise<ModelInfo[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Try with API key if provided, otherwise try public endpoint
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers,
    });

    if (!response.ok) {
      // If public endpoint fails, try again with API key if we have one
      if (!apiKey) {
        throw new Error('Failed to fetch models. API key may be required.');
      }
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}
