import { Capacitor, registerPlugin } from '@capacitor/core';

interface ZaraExternalBrowserPlugin {
  openUrl(options: { url: string }): Promise<void>;
}

const externalBrowser = registerPlugin<ZaraExternalBrowserPlugin>('ZaraExternalBrowser');

export function isAndroidExternalBrowserAvailable(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function openAndroidExternalUrl(url: string): Promise<void> {
  await externalBrowser.openUrl({ url });
}
