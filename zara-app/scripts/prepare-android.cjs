'use strict';

const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const androidDirectory = 'android';
if (!existsSync(androidDirectory)) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['cap', 'add', 'android'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('CAPACITOR_ANDROID_GENERATION_FAILED');
  }
}

const javaDirectory = 'android/app/src/main/java/com/zara/assistant';
mkdirSync(javaDirectory, { recursive: true });
const activity = `package com.zara.assistant;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void load() {
    super.load();
    if (getBridge() != null) {
      CookieManager.getInstance().setAcceptThirdPartyCookies(
        getBridge().getWebView(),
        true
      );
    }
  }
}
`;
writeFileSync(javaDirectory + '/MainActivity.java', activity, 'utf8');
console.log('ZARA Android project is ready with its scoped session-cookie policy.');
