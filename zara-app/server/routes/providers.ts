import { Router } from 'express';
import { z } from 'zod';
import {
  getAllProviders,
  getProviderById,
  updateProviderConfig,
  setProviderStatus,
  setProviderEnabled,
} from '../db/repositories/providerRepository';

export const providerRouter = Router();

const configSchema = z.record(
  z.string().min(1).max(100),
  z.unknown()
);

const statusSchema = z.object({
  status: z.enum([
    'unconfigured',
    'pending_verification',
    'ready',
    'disabled',
  ]),
});

const enabledSchema = z.object({
  enabled: z.boolean(),
});

// GET: All providers
providerRouter.get('/', (_req, res) => {
  return res.status(200).json({
    providers: getAllProviders(),
  });
});

// GET: Single provider
providerRouter.get('/:id', (req, res) => {
  const provider = getProviderById(req.params.id);

  if (!provider) {
    return res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
  }

  return res.status(200).json({ provider });
});

// PATCH: Update provider configuration
providerRouter.patch('/:id/config', (req, res) => {
  const parsed = configSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_PROVIDER_CONFIG',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const provider = updateProviderConfig(req.params.id, parsed.data);

  if (!provider) {
    return res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
  }

  return res.status(200).json({ provider });
});

// PATCH: Update provider status
providerRouter.patch('/:id/status', (req, res) => {
  const parsed = statusSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_PROVIDER_STATUS',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const provider = setProviderStatus(req.params.id, parsed.data.status);

  if (!provider) {
    return res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
  }

  return res.status(200).json({ provider });
});

// PATCH: Enable or disable provider
providerRouter.patch('/:id/enabled', (req, res) => {
  const parsed = enabledSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: 'INVALID_PROVIDER_ENABLED_VALUE',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const provider = setProviderEnabled(
      req.params.id,
      parsed.data.enabled
    );

    if (!provider) {
      return res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
    }

    return res.status(200).json({ provider });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROVIDER_NOT_READY') {
      return res.status(409).json({ error: 'PROVIDER_NOT_READY' });
    }

    throw error;
  }
});
