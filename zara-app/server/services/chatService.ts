
import {
  getProviderById,
} from '../db/repositories/providerRepository.js';

export interface SendChatMessageParams {
  threadId: string;
  content: string;
  providerId: string;
}

export class ChatServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ChatServiceError';
  }
}

export function sendChatMessage(
  params: SendChatMessageParams
): never {
  const threadId = params.threadId.trim();
  const content = params.content.trim();
  const providerId = params.providerId.trim();

  if (!threadId) {
    throw new ChatServiceError(
      'THREAD_ID_REQUIRED',
      'Thread ID is required.'
    );
  }

  if (!content) {
    throw new ChatServiceError(
      'MESSAGE_CONTENT_REQUIRED',
      'Message content is required.'
    );
  }

  if (!providerId) {
    throw new ChatServiceError(
      'PROVIDER_ID_REQUIRED',
      'Provider ID is required.'
    );
  }

  const provider = getProviderById(providerId);

  if (!provider) {
    throw new ChatServiceError(
      'PROVIDER_NOT_FOUND',
      'Selected provider was not found.'
    );
  }

  if (provider.status !== 'ready' || provider.enabled !== 1) {
    throw new ChatServiceError(
      'PROVIDER_NOT_CONFIGURED',
      'Selected AI provider is not ready.'
    );
  }

  throw new ChatServiceError(
    'PROVIDER_ADAPTER_NOT_IMPLEMENTED',
    'The selected provider adapter has not been implemented yet.'
  );
}
