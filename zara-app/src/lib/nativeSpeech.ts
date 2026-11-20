import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

type SpeechResult = { transcript: string; language: string };
type SpeechError = { code: string };

interface ZaraSpeechPlugin {
  startListening(options: { language: 'bn-BD' | 'en-US' }): Promise<void>;
  stopListening(): Promise<void>;
  cancelListening(): Promise<void>;
  addListener(eventName: 'result', listener: (event: SpeechResult) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'error', listener: (event: SpeechError) => void): Promise<PluginListenerHandle>;
}

const nativeSpeech = registerPlugin<ZaraSpeechPlugin>('ZaraSpeechRecognition');

export function isAndroidNativeSpeechAvailable(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export type NativeSpeechSession = {
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
};

export async function startNativeSpeech(
  language: 'bn-BD' | 'en-US',
  onResult: (transcript: string) => void,
  onError: (code: string) => void,
): Promise<NativeSpeechSession> {
  let resultHandle: PluginListenerHandle | undefined;
  let errorHandle: PluginListenerHandle | undefined;
  let closed = false;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    await Promise.all([
      resultHandle?.remove(),
      errorHandle?.remove(),
    ]);
  };

  try {
    resultHandle = await nativeSpeech.addListener('result', (event) => {
      void cleanup();
      onResult(typeof event.transcript === 'string' ? event.transcript.trim() : '');
    });
    errorHandle = await nativeSpeech.addListener('error', (event) => {
      void cleanup();
      onError(typeof event.code === 'string' ? event.code : 'SPEECH_RECOGNITION_FAILED');
    });
    await nativeSpeech.startListening({ language });
  } catch (error) {
    await cleanup();
    throw error;
  }

  return {
    stop: () => nativeSpeech.stopListening(),
    cancel: async () => {
      try {
        await nativeSpeech.cancelListening();
      } finally {
        await cleanup();
      }
    },
  };
}
