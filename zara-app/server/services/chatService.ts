import {
  createMessage,
  getMessageById,
  getMessagesByThread,
  type Message,
} from '../db/repositories/messageRepository.js';

import {
  claimChatRequest,
  completeChatRequest,
  releaseChatRequest,
} from '../db/repositories/chatRequestRepository.js';

import { getThreadById } from '../db/repositories/threadRepository.js';
import {
  streamWithFailover,
  type BrainProviderId,
} from './brainManager.js';

import type { ChatMessage } from './providerAdapter.js';

export interface SendChatMessageParams {
  threadId: string;
  content: string;
  providerId?: string;
  clientMessageId: string;
  signal?: AbortSignal;
  onToken: (token: string) => void;
}

export interface SendChatMessageResult {
  userMessage: Message;
  assistantMessage: Message;
  providerId: BrainProviderId;
  model?: string;
  replayed?: boolean;
}

export class ChatServiceError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
    this.name = 'ChatServiceError';
  }
}

export async function sendChatMessage(
  params: SendChatMessageParams,
): Promise<SendChatMessageResult> {
  const threadId = params.threadId.trim();
  const content = params.content.trim();
  const clientMessageId = params.clientMessageId.trim();

  if (!threadId) {
    throw new ChatServiceError('THREAD_ID_REQUIRED');
  }

  if (!content) {
    throw new ChatServiceError('MESSAGE_CONTENT_REQUIRED');
  }

  if (!clientMessageId || clientMessageId.length > 80) {
    throw new ChatServiceError('CLIENT_MESSAGE_ID_REQUIRED');
  }

  if (!getThreadById(threadId)) {
    throw new ChatServiceError('THREAD_NOT_FOUND');
  }

  // Persist the idempotent user message first because chat_requests has a
  // foreign key to messages. Reusing an ID with different content is rejected.
  let userMessage: Message;
  try {
    userMessage = createMessage(
      threadId,
      'user',
      content,
      clientMessageId,
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'MESSAGE_ID_CONFLICT') {
      throw new ChatServiceError('CLIENT_MESSAGE_ID_CONFLICT');
    }
    throw error;
  }

  const claim = claimChatRequest(
    clientMessageId,
    threadId,
    userMessage.id,
  );

  if (!claim.claimed) {
    if (
      claim.record.thread_id !== threadId ||
      claim.record.user_message_id !== userMessage.id
    ) {
      throw new ChatServiceError('CLIENT_MESSAGE_ID_CONFLICT');
    }

    if (
      claim.record.status === 'completed' &&
      claim.record.assistant_message_id
    ) {
      const assistantMessage = getMessageById(
        claim.record.assistant_message_id,
      );

      if (assistantMessage && claim.record.provider_id) {
        return {
          userMessage,
          assistantMessage,
          providerId: claim.record.provider_id as BrainProviderId,
          model: claim.record.model ?? undefined,
          replayed: true,
        };
      }
    }

    throw new ChatServiceError('CHAT_REQUEST_ALREADY_IN_PROGRESS');
  }

  try {
    const history = getMessagesByThread(threadId).slice(-21);

    const messages: ChatMessage[] = history.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const response = await streamWithFailover(
      {
        messages,
        signal: params.signal,
      },
      params.providerId,
      params.onToken,
    );

    const assistantMessage = createMessage(
      threadId,
      'assistant',
      response.content,
    );

    completeChatRequest(
      clientMessageId,
      assistantMessage.id,
      response.providerId,
      response.model,
    );

    return {
      userMessage,
      assistantMessage,
      providerId: response.providerId,
      model: response.model,
    };
  } catch (error) {
    releaseChatRequest(clientMessageId);
    throw error;
  }
}
