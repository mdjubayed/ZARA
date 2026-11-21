import { Router } from 'express';
import { z } from 'zod';
import {
  getAllSettings,
  setSetting,
  setMultipleSettings,
  deleteSetting,
} from '../db/repositories/settingsRepository.js';

export const settingsRouter = Router();

const SECRET_SETTING_KEY =
  /(api[_-]?key|secret|access[_-]?token|refresh[_-]?token|password|credential|authorization|private[_-]?key)/i;

function isSecretSettingKey(key: string): boolean {
  return SECRET_SETTING_KEY.test(key);
}

function containsSecretKey(value: unknown, depth = 0): boolean {
  if (depth > 12) return true;

  if (Array.isArray(value)) {
    return value.some((item) => containsSecretKey(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, nested]) =>
        isSecretSettingKey(key) || containsSecretKey(nested, depth + 1),
    );
  }

  return false;
}

function redactSecretKeys(value: unknown, depth = 0): unknown {
  if (depth > 12) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => redactSecretKeys(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSecretSettingKey(key))
        .map(([key, nested]) => [
          key,
          redactSecretKeys(nested, depth + 1),
        ]),
    );
  }

  return value;
}

function getPublicSettings(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(getAllSettings())
      .filter(([key]) => !isSecretSettingKey(key))
      .map(([key, value]) => [key, redactSecretKeys(value)]),
  );
}

const settingValueSchema = z.union([
  z.string().max(10000),
  z.number().finite(),
  z.boolean(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.null(),
]);

const updateSettingSchema = z.object({
  value: settingValueSchema,
}).strict();

const updateMultipleSettingsSchema = z.record(
  z.string().min(1).max(100),
  settingValueSchema,
);

settingsRouter.get('/', (_req, res) => {
  return res.status(200).json({ settings: getPublicSettings() });
});

settingsRouter.get('/:key', (req, res) => {
  const key = req.params.key;
  if (isSecretSettingKey(key)) {
    return res.status(404).json({ error: 'SETTING_NOT_FOUND' });
  }

  const settings = getPublicSettings();
  if (!Object.prototype.hasOwnProperty.call(settings, key)) {
    return res.status(404).json({ error: 'SETTING_NOT_FOUND' });
  }

  return res.status(200).json({ key, value: settings[key] });
});

settingsRouter.patch('/:key', (req, res) => {
  const key = req.params.key;
  if (isSecretSettingKey(key)) {
    return res.status(400).json({
      error: 'SECRET_SETTINGS_NOT_ALLOWED_USE_SERVER_ENVIRONMENT',
    });
  }

  const parsed = updateSettingSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_SETTING_DATA',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  if (containsSecretKey(parsed.data.value)) {
    return res.status(400).json({
      error: 'SECRET_SETTINGS_NOT_ALLOWED_USE_SERVER_ENVIRONMENT',
    });
  }

  setSetting(key, parsed.data.value);
  return res.status(200).json({ success: true, key, value: parsed.data.value });
});

settingsRouter.put('/', (req, res) => {
  const parsed = updateMultipleSettingsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_SETTINGS_DATA',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  if (
    Object.keys(parsed.data).some(isSecretSettingKey) ||
    containsSecretKey(parsed.data)
  ) {
    return res.status(400).json({
      error: 'SECRET_SETTINGS_NOT_ALLOWED_USE_SERVER_ENVIRONMENT',
    });
  }

  setMultipleSettings(parsed.data);
  return res.status(200).json({ success: true, settings: getPublicSettings() });
});

settingsRouter.delete('/:key', (req, res) => {
  if (isSecretSettingKey(req.params.key)) {
    return res.status(400).json({
      error: 'SECRET_SETTINGS_NOT_ALLOWED_USE_SERVER_ENVIRONMENT',
    });
  }

  const deleted = deleteSetting(req.params.key);
  if (!deleted) {
    return res.status(404).json({ error: 'SETTING_NOT_FOUND' });
  }

  return res.status(200).json({ success: true });
});
