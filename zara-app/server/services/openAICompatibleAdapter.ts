
import type {
  ChatMessage,
  ProviderAdapter,
  ProviderGenerationRequest,
  ProviderGenerationResponse,
  ProviderUsage,
} from './providerAdapter.js';
import { ProviderRequestError } from './providerAdapter.js';

interface AdapterOptions {
  providerId: 'omniroute' | 'freellmapi';
  baseUrl: string;
  apiKey: () => string | undefined;
  defaultModel: () => string | undefined;
  timeoutMs: number;
}

interface ChatCompletionPayload {
  model?: string;
  choices?: Array<{
    message?: { content?: string | Array<{ type?: string; text?: string }> };
    delta?: { content?: string | Array<{ type?: string; text?: string }> };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: string };
}

interface RequestSignals {
  signal: AbortSignal;
  timeoutSignal: AbortSignal;
  parentSignal?: AbortSignal;
}

function contentToText(value: unknown): string {
  if (typeof value === 'string') return value;

  if (!Array.isArray(value)) return '';

  return value
    .map((part) => {
      if (
        part &&
        typeof part === 'object' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        return part.text;
      }

      return '';
    })
    .join('');
}

function mapUsage(
  usage?: ChatCompletionPayload['usage'],
): ProviderUsage | undefined {
  if (!usage) return undefined;

  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly providerId: 'omniroute' | 'freellmapi';

  private readonly baseUrl: string;
  private readonly getApiKey: () => string | undefined;
  private readonly getDefaultModel: () => string | undefined;
  private readonly timeoutMs: number;

  constructor(options: AdapterOptions) {
    this.providerId = options.providerId;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.getApiKey = options.apiKey;
    this.getDefaultModel = options.defaultModel;
    this.timeoutMs = options.timeoutMs;
  }

  private credentials(): { key: string; model: string } {
    const key = this.getApiKey()?.trim();
    const model = this.getDefaultModel()?.trim();

    if (!key) {
      throw new ProviderRequestError(
        this.providerId,
        'API_KEY_NOT_CONFIGURED',
        undefined,
        true,
      );
    }

    return {
      key,
      model: model ?? '',
    };
  }

  private createRequestSignals(parentSignal?: AbortSignal): RequestSignals {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);

    return {
      signal: parentSignal
        ? AbortSignal.any([parentSignal, timeoutSignal])
        : timeoutSignal,
      timeoutSignal,
      parentSignal,
    };
  }

  private normalizeError(
    error: unknown,
    signals: RequestSignals,
    fallbackCode: string,
  ): ProviderRequestError {
    if (error instanceof ProviderRequestError) {
      return error;
    }

    // User cancellation must never trigger automatic failover.
    if (signals.parentSignal?.aborted) {
      return new ProviderRequestError(
        this.providerId,
        'REQUEST_ABORTED',
      );
    }

    // Timeout is recoverable and may use the backup provider.
    if (signals.timeoutSignal.aborted) {
      return new ProviderRequestError(
        this.providerId,
        'PROVIDER_TIMEOUT',
        undefined,
        true,
      );
    }

    return new ProviderRequestError(
      this.providerId,
      fallbackCode,
      undefined,
      true,
    );
  }

  private async fetchWithTimeout(
    path: string,
    init: RequestInit,
    signals: RequestSignals,
    apiKey: string,
  ): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(init.headers ?? {}),
        },
        signal: signals.signal,
      });
    } catch (error) {
      throw this.normalizeError(
        error,
        signals,
        'PROVIDER_CONNECTION_FAILED',
      );
    }
  }

  private async assertResponse(response: Response): Promise<void> {
    if (response.ok) return;

    const recoverable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500;

    const code =
      response.status === 401 || response.status === 403
        ? 'PROVIDER_AUTHENTICATION_FAILED'
        : response.status === 429
          ? 'PROVIDER_RATE_LIMITED'
          : response.status >= 500
            ? 'PROVIDER_SERVER_ERROR'
            : `PROVIDER_HTTP_${response.status}`;

    throw new ProviderRequestError(
      this.providerId,
      code,
      response.status,
      recoverable,
    );
  }

  async verify(): Promise<string[]> {
    const { key } = this.credentials();
    const signals = this.createRequestSignals();

    try {
      const response = await this.fetchWithTimeout(
        '/models',
        { method: 'GET' },
        signals,
        key,
      );

      await this.assertResponse(response);

      const payload = (await response.json()) as {
        data?: Array<{ id?: string }>;
      };

      return (payload.data ?? [])
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id));
    } catch (error) {
      throw this.normalizeError(
        error,
        signals,
        'PROVIDER_VERIFICATION_FAILED',
      );
    }
  }

  async generate(
    request: ProviderGenerationRequest,
  ): Promise<ProviderGenerationResponse> {
    const { key, model: defaultModel } = this.credentials();

    if (!request.model && !defaultModel) {
      throw new ProviderRequestError(
        this.providerId,
        'MODEL_NOT_CONFIGURED',
        undefined,
        true,
      );
    }

    const signals = this.createRequestSignals(request.signal);

    try {
      const response = await this.fetchWithTimeout(
        '/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: request.model ?? defaultModel,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stream: false,
          }),
        },
        signals,
        key,
      );

      await this.assertResponse(response);

      const payload = (await response.json()) as ChatCompletionPayload;
      const content = contentToText(
        payload.choices?.[0]?.message?.content,
      );

      if (!content) {
        throw new ProviderRequestError(
          this.providerId,
          'PROVIDER_EMPTY_RESPONSE',
          undefined,
          true,
        );
      }

      return {
        content,
        model: payload.model,
        usage: mapUsage(payload.usage),
      };
    } catch (error) {
      throw this.normalizeError(
        error,
        signals,
        'PROVIDER_REQUEST_FAILED',
      );
    }
  }

  async stream(
    request: ProviderGenerationRequest,
    onToken: (token: string) => void,
  ): Promise<ProviderGenerationResponse> {
    const { key, model: defaultModel } = this.credentials();

    if (!request.model && !defaultModel) {
      throw new ProviderRequestError(
        this.providerId,
        'MODEL_NOT_CONFIGURED',
        undefined,
        true,
      );
    }

    const signals = this.createRequestSignals(request.signal);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const response = await this.fetchWithTimeout(
        '/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            model: request.model ?? defaultModel,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stream: true,
          }),
        },
        signals,
        key,
      );

      await this.assertResponse(response);

      if (!response.body) {
        throw new ProviderRequestError(
          this.providerId,
          'PROVIDER_STREAM_UNAVAILABLE',
          undefined,
          true,
        );
      }

      reader = response.body.getReader();

      const decoder = new TextDecoder();

      let buffer = '';
      let content = '';
      let responseModel: string | undefined;
      let usage: ProviderUsage | undefined;

      const consumeEvent = (event: string): void => {
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n');

        if (!data || data === '[DONE]') return;

        let payload: ChatCompletionPayload;

        try {
          payload = JSON.parse(data) as ChatCompletionPayload;
        } catch {
          return;
        }

        if (payload.error) {
          const providerCode = payload.error.code?.toLowerCase() ?? '';
          const providerMessage = payload.error.message?.toLowerCase() ?? '';
          const authenticationFailure =
            /auth|unauthor|invalid[_ -]?api[_ -]?key|forbidden|permission/.test(
              `${providerCode} ${providerMessage}`,
            );
          const rateLimitFailure =
            /rate[_ -]?limit|too[_ -]?many[_ -]?requests|quota/.test(
              `${providerCode} ${providerMessage}`,
            );

          throw new ProviderRequestError(
            this.providerId,
            authenticationFailure
              ? 'PROVIDER_AUTHENTICATION_FAILED'
              : rateLimitFailure
                ? 'PROVIDER_RATE_LIMITED'
                : 'PROVIDER_STREAM_ERROR',
            undefined,
            !authenticationFailure,
          );
        }

        responseModel = payload.model ?? responseModel;
        usage = mapUsage(payload.usage) ?? usage;

        const token = contentToText(
          payload.choices?.[0]?.delta?.content,
        );

        if (token) {
          content += token;
          onToken(token);
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, '\n');

        let boundary = buffer.indexOf('\n\n');

        while (boundary >= 0) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          consumeEvent(event);

          boundary = buffer.indexOf('\n\n');
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        consumeEvent(buffer);
      }

      if (!content) {
        throw new ProviderRequestError(
          this.providerId,
          'PROVIDER_EMPTY_RESPONSE',
          undefined,
          true,
        );
      }

      return {
        content,
        model: responseModel,
        usage,
      };
    } catch (error) {
      await reader?.cancel().catch(() => undefined);

      throw this.normalizeError(
        error,
        signals,
        'PROVIDER_STREAM_INTERRUPTED',
      );
    } finally {
      reader?.releaseLock();
    }
  }
}

export type { ChatMessage };
