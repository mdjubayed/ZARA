'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const androidDirectory = 'android';
if (!existsSync(androidDirectory)) {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx cap add android']
    : ['cap', 'add', 'android'];
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('CAPACITOR_ANDROID_GENERATION_FAILED');
  }
}

const javaDirectory = 'android/app/src/main/java/com/zara/assistant';
mkdirSync(javaDirectory, { recursive: true });
const plugin = `package com.zara.assistant;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
  name = "ZaraSpeechRecognition",
  permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
  }
)
public class ZaraSpeechRecognitionPlugin extends Plugin {
  private SpeechRecognizer recognizer;
  private String activeLanguage = "bn-BD";

  @PluginMethod
  public void startListening(PluginCall call) {
    getActivity().runOnUiThread(() -> startListeningOnMainThread(call));
  }

  private void startListeningOnMainThread(PluginCall call) {
    String language = call.getString("language", "bn-BD");
    if (!"bn-BD".equals(language) && !"en-US".equals(language)) {
      call.reject("UNSUPPORTED_SPEECH_LANGUAGE");
      return;
    }
    if (recognizer != null) {
      call.reject("SPEECH_RECOGNITION_ALREADY_ACTIVE");
      return;
    }
    if (getPermissionState("microphone") != PermissionState.GRANTED) {
      requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
      return;
    }
    beginRecognition(call, language);
  }

  @PermissionCallback
  private void microphonePermissionCallback(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      if (getPermissionState("microphone") != PermissionState.GRANTED) {
        call.reject("MICROPHONE_PERMISSION_DENIED");
        return;
      }
      String language = call.getString("language", "bn-BD");
      beginRecognition(call, language);
    });
  }

  private void beginRecognition(PluginCall call, String language) {
    if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
      call.reject("SPEECH_RECOGNIZER_UNAVAILABLE");
      return;
    }

    try {
      activeLanguage = language;
      recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
      recognizer.setRecognitionListener(new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onPartialResults(Bundle partialResults) {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onResults(Bundle results) {
          ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
          JSObject payload = new JSObject();
          payload.put("transcript", matches == null || matches.isEmpty() ? "" : matches.get(0));
          payload.put("language", activeLanguage);
          notifyListeners("result", payload);
          releaseRecognizer();
        }

        @Override
        public void onError(int error) {
          JSObject payload = new JSObject();
          payload.put("code", "ANDROID_SPEECH_ERROR_" + error);
          notifyListeners("error", payload);
          releaseRecognizer();
        }
      });

      Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
      intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
      intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
      intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
      intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
      intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
      recognizer.startListening(intent);

      JSObject response = new JSObject();
      response.put("started", true);
      call.resolve(response);
    } catch (Exception error) {
      releaseRecognizer();
      call.reject("SPEECH_RECOGNITION_START_FAILED");
    }
  }

  @PluginMethod
  public void stopListening(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      if (recognizer != null) {
        try {
          recognizer.stopListening();
        } catch (Exception error) {
          releaseRecognizer();
          call.reject("SPEECH_RECOGNITION_STOP_FAILED");
          return;
        }
      }
      call.resolve();
    });
  }

  @PluginMethod
  public void cancelListening(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      if (recognizer != null) {
        try {
          recognizer.cancel();
        } catch (Exception ignored) {}
      }
      releaseRecognizer();
      call.resolve();
    });
  }

  private void releaseRecognizer() {
    if (recognizer != null) {
      SpeechRecognizer current = recognizer;
      recognizer = null;
      try {
        current.destroy();
      } catch (Exception ignored) {}
    }
  }

  @Override
  protected void handleOnDestroy() {
    releaseRecognizer();
    super.handleOnDestroy();
  }
}
`;

const externalBrowserPlugin = `package com.zara.assistant;

import android.content.Intent;
import android.net.Uri;
import android.util.Patterns;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ZaraExternalBrowser")
public class ZaraExternalBrowserPlugin extends Plugin {
  @PluginMethod
  public void openUrl(PluginCall call) {
    String rawUrl = call.getString("url");
    if (rawUrl == null || rawUrl.length() > 2048) {
      call.reject("INVALID_EXTERNAL_URL");
      return;
    }

    Uri uri = Uri.parse(rawUrl);
    String host = uri.getHost();
    if (!"https".equalsIgnoreCase(uri.getScheme())
        || host == null
        || uri.getUserInfo() != null
        || (uri.getPort() != -1 && uri.getPort() != 443)) {
      call.reject("EXTERNAL_URL_NOT_ALLOWED");
      return;
    }

    String hostname = host.toLowerCase(java.util.Locale.ROOT);
    if (hostname.endsWith(".")) hostname = hostname.substring(0, hostname.length() - 1);
    if (Patterns.IP_ADDRESS.matcher(hostname).matches()
        || hostname.contains(":")
        || hostname.equals("localhost")
        || hostname.endsWith(".localhost")
        || hostname.endsWith(".local")
        || hostname.endsWith(".internal")
        || hostname.endsWith(".test")
        || hostname.endsWith(".invalid")
        || !hostname.contains(".")) {
      call.reject("EXTERNAL_URL_NOT_ALLOWED");
      return;
    }

    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
    intent.addCategory(Intent.CATEGORY_BROWSABLE);
    try {
      getActivity().startActivity(intent);
      call.resolve();
    } catch (Exception error) {
      call.reject("EXTERNAL_BROWSER_UNAVAILABLE");
    }
  }
}
`;

const activity = `package com.zara.assistant;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ZaraSpeechRecognitionPlugin.class);
    registerPlugin(ZaraExternalBrowserPlugin.class);
    super.onCreate(savedInstanceState);
  }

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
writeFileSync(javaDirectory + '/ZaraSpeechRecognitionPlugin.java', plugin, 'utf8');
writeFileSync(javaDirectory + '/ZaraExternalBrowserPlugin.java', externalBrowserPlugin, 'utf8');

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = readFileSync(manifestPath, 'utf8');
const declarations = [];
if (!manifest.includes('android.permission.RECORD_AUDIO')) {
  declarations.push('<uses-permission android:name="android.permission.RECORD_AUDIO" />');
}
if (!manifest.includes('android.speech.RecognitionService')) {
  declarations.push('<queries><intent><action android:name="android.speech.RecognitionService" /></intent></queries>');
}
if (declarations.length > 0) {
  const openingTag = manifest.match(/<manifest\b[^>]*>/)?.[0];
  if (!openingTag) throw new Error('ANDROID_MANIFEST_INVALID');
  manifest = manifest.replace(openingTag, openingTag + '\n    ' + declarations.join('\n    '));
  writeFileSync(manifestPath, manifest, 'utf8');
}

console.log('ZARA Android project is ready with secure sessions and native speech recognition.');
