export type ZaraDesktopAppId = 'notepad' | 'calculator';

export interface ZaraDesktopBridge {
  readonly isDesktop: true;
  launchApp(appId: ZaraDesktopAppId): Promise<{ ok: boolean; error?: string }>;
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
}

declare global {
  interface Window {
    zaraDesktop?: ZaraDesktopBridge;
  }
}

export {};
