export type ZaraDesktopAppId = 'notepad' | 'calculator';
export type ZaraDesktopProviderId = 'omniroute' | 'freellmapi';

export interface ZaraDesktopBridge {
  readonly isDesktop: true;
  getProviderKeyStatus(): Promise<{ available: boolean; omniroute: boolean; freellmapi: boolean }>;
  saveProviderKey(providerId: ZaraDesktopProviderId, apiKey: string): Promise<{ ok: boolean; error?: string }>;
  clearProviderKey(providerId: ZaraDesktopProviderId): Promise<{ ok: boolean; error?: string }>;
  launchApp(appId: ZaraDesktopAppId): Promise<{ ok: boolean; error?: string }>;
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
  openTextFile(): Promise<{ ok: boolean; name?: string; content?: string; error?: string }>;
  saveTextFile(suggestedName: string, content: string): Promise<{ ok: boolean; name?: string; error?: string }>;
}

declare global {
  interface Window {
    zaraDesktop?: ZaraDesktopBridge;
  }
}

export {};
