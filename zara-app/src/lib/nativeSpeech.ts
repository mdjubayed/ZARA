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


export function getNativeSpeechErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    MICROPHONE_PERMISSION_DENIED: 'Microphone permission was not granted. Allow microphone access in Android Settings.',
    SPEECH_RECOGNIZER_UNAVAILABLE: 'No Android speech-recognition service is available on this device.',
    SPEECH_RECOGNITION_ALREADY_ACTIVE: 'Voice recognition is already running.',
    SPEECH_RECOGNITION_START_FAILED: 'Android could not start voice recognition. Check microphone permission and try again.',
    ANDROID_SPEECH_ERROR_1: 'Voice recognition timed out while connecting to its service.',
    ANDROID_SPEECH_ERROR_2: 'Voice recognition could not connect. Check the device connection and try again.',
    ANDROID_SPEECH_ERROR_3: 'The microphone could not capture audio. Check microphone access.',
    ANDROID_SPEECH_ERROR_6: 'No speech was detected. Tap Start Speaking and try again.',
    ANDROID_SPEECH_ERROR_7: 'The speech service could not recognize those words. Try again or change the language.',
    ANDROID_SPEECH_ERROR_8: 'The Android speech service is busy. Wait a moment and try again.',
    ANDROID_SPEECH_ERROR_9: 'Android did not grant microphone permission.',
    ANDROID_SPEECH_ERROR_10: 'The speech service is receiving too many requests. Wait and try again.',
    ANDROID_SPEECH_ERROR_12: 'This speech service does not support the selected language.',
    ANDROID_SPEECH_ERROR_13: 'The selected language is not currently available on this device.',
  };
  return messages[code] ?? 'Android voice input failed. Check the microphone, language, and device speech service.';
}
