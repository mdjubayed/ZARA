import { Router } from 'express';
import { z } from 'zod';
import {
  getAllSettings,
  setSetting,
  setMultipleSettings,
  deleteSetting,
} from '../db/repositories/settingsRepository';

export const settingsRouter = Router();

const SECRET_SETTING_KEY = /(api[_-]?key|secret|access[_-]?token|refresh[_-]?token|password|credential)/i;

function isSecretSettingKey(key: string): boolean {
  return SECRET_SETTING_KEY.test(key);
}

function getPublicSettings(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(getAllSettings()).filter(([key]) => !isSecretSettingKey(key)),
  );
}

const settingValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.null(),
]);

const updateSettingSchema = z.object({
  value: settingValueSchema,
});

const updateMultipleSettingsSchema = z.record(
  z.string().min(1).max(100),
  settingValueSchema
);

// GET: All settings
settingsRouter.get('/', (_req, res) => {
  return res.status(200).json({
    settings: getPublicSettings(),
  });
});

// GET: Single setting
settingsRouter.get('/:key', (req, res) => {
  const key = req.params.key;
  if (isSecretSettingKey(key)) return res.status(404).json({ error: 'SETTING_NOT_FOUND' });
  const settings = getPublicSettings();

  if (!Object.prototype.hasOwnProperty.call(settings, key)) {
    return res.status(404).json({ error: 'SETTING_NOT_FOUND' });
  }

  const value = settings[key];

  return res.status(200).json({
    key: req.params.key,
    value,
  });
});

// PATCH: Update one setting
settingsRouter.patch('/:key', (req, res) => {
  if (isSecretSettingKey(req.params.key)) {
    return res.status(400).json({ error: 'SECRET_SETTINGS_NOT_ALLOWED_USE_SERVER_ENVIRONMENT' });
  }

  const parsed = updateSettingSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_SETTING_DATA',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  setSetting(req.params.key, parsed.data.value);

  return res.status(200).json({
    success: true,
    key: req.params.key,
    value: parsed.data.value,
  });
});

// PUT: Update multiple settings
settingsRouter.put('/', (req, res) => {
  const parsed = updateMultipleSettingsSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_SETTINGS_DATA',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  if (Object.keys(parsed.data).some(isSecretSettingKey)) {
    return res.status(400).json({ error: 'SECRET_SETTINGS_NOT_ALLOWED_USE_SERVER_ENVIRONMENT' });
  }

  setMultipleSettings(parsed.data);

  return res.status(200).json({
    success: true,
    settings: getAllSettings(),
  });
});

// DELETE: Remove one setting
settingsRouter.delete('/:key', (req, res) => {
  const deleted = deleteSetting(req.params.key);

  if (!deleted) {
    return res.status(404).json({ error: 'SETTING_NOT_FOUND' });
  }

  return res.status(200).json({ success: true });
});
