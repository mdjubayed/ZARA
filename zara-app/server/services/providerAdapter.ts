
export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface ProviderGenerationRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ProviderGenerationResponse {
  content: string;
  model?: string;
  usage?: ProviderUsage;
}

export interface ProviderAdapter {
  readonly providerId: string;

  generate(
    request: ProviderGenerationRequest
  ): Promise<ProviderGenerationResponse>;
}
