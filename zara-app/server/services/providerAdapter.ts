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
  generate(request: ProviderGenerationRequest): Promise<ProviderGenerationResponse>;
  stream(
    request: ProviderGenerationRequest,
    onToken: (token: string) => void,
  ): Promise<ProviderGenerationResponse>;
  verify(): Promise<string[]>;
}

export class ProviderRequestError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly recoverable = false,
  ) {
    super(code);
    this.name = 'ProviderRequestError';
  }
}
