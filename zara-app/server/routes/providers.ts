import { Router } from 'express';
import { z } from 'zod';
import {
  getAllProviders,
  getProviderById,
  markProviderReadyAfterVerification,
  setProviderStatus,
  setProviderEnabled,
  isSupportedProviderId,
  type Provider,
} from '../db/repositories/providerRepository.js';
import { verifyProvider } from '../services/brainManager.js';
import { initializeProviderAdapters } from '../services/providerAdapters.js';
import { hasProviderApiKey } from '../services/secretStore.js';
import { ProviderRequestError } from '../services/providerAdapter.js';
import { getProviderModel } from '../services/providerConfig.js';

export const providerRouter = Router();

function serializeProvider(provider: Provider) {
  return {
    id: provider.id,
    name: provider.name,
    status: provider.status,
    enabled: provider.enabled,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
    model: isSupportedProviderId(provider.id) ? getProviderModel(provider.id) ?? '' : '',
  };
}

const statusSchema = z.object({
  status: z.enum(['unconfigured', 'pending_verification', 'disabled']),
});
const enabledSchema = z.object({ enabled: z.boolean() });

providerRouter.get('/', (_req, res) => {
  return res.status(200).json({ providers: getAllProviders().map(serializeProvider) });
});

providerRouter.get('/:id', (req, res) => {
  const provider = getProviderById(req.params.id);
  if (!provider) return res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
  return res.status(200).json({ provider: serializeProvider(provider) });
});

providerRouter.post('/:id/verify', async (req, res) => {
  const id = req.params.id;
  if (!isSupportedProviderId(id)) return res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
  if (!hasProviderApiKey(id)) {
    setProviderStatus(id, 'unconfigured');
    return res.status(409).json({ error: 'PROVIDER_API_KEY_NOT_CONFIGURED' });
  }
  try {
    initializeProviderAdapters();
    const model = getProviderModel(id);
    const models = await verifyProvider(id);
    if (models.length === 0) {
      setProviderStatus(id, 'pending_verification');
      return res.status(502).json({ error: 'PROVIDER_NO_MODELS_RETURNED' });
    }
    if (!model) {
      setProviderStatus(id, 'pending_verification');
      return res.status(200).json({
        provider: getProviderById(id) ? serializeProvider(getProviderById(id)!) : null,
        modelCount: models.length,
        models,
        requiresModelSelection: true,
      });
    }
    if (model !== 'auto' && !models.includes(model)) {
      setProviderStatus(id, 'pending_verification');
      return res.status(400).json({ error: 'PROVIDER_MODEL_NOT_AVAILABLE', models });
    }
    const provider = markProviderReadyAfterVerification(id);
    return res.status(200).json({ provider: provider ? serializeProvider(provider) : null, modelCount: models.length, models, requiresModelSelection: false });
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      setProviderStatus(id, 'pending_verification');

      if (error.code === 'PROVIDER_AUTHENTICATION_FAILED') {
        return res.status(401).json({ error: error.code });
      }

      if (error.code === 'PROVIDER_RATE_LIMITED') {
        return res.status(429).json({ error: error.code });
      }

      if (error.code === 'PROVIDER_TIMEOUT') {
        return res.status(504).json({ error: error.code });
      }

      if (error.code === 'PROVIDER_CONNECTION_FAILED') {
        return res.status(503).json({ error: error.code });
      }

      return res.status(502).json({ error: error.code });
    }

    setProviderStatus(id, 'pending_verification');
    return res.status(502).json({ error: 'PROVIDER_VERIFICATION_FAILED' });
  }
});

providerRouter.patch('/:id/config', (_req, res) => {
  return res.status(409).json({ error: 'PROVIDER_CONFIG_UPDATE_DISABLED_USE_ENVIRONMENT_SECRETS' });
});

providerRouter.patch('/:id/status', (req, res) => {
  const parsed = statusSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_PROVIDER_STATUS' });
  const provider = setProviderStatus(req.params.id, parsed.data.status);
  if (!provider) return res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
  return res.status(200).json({ provider: serializeProvider(provider) });
});

providerRouter.patch('/:id/enabled', (req, res) => {
  const parsed = enabledSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_PROVIDER_ENABLED_VALUE' });
  try {
    const provider = setProviderEnabled(req.params.id, parsed.data.enabled);
    if (!provider) return res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
    return res.status(200).json({ provider: serializeProvider(provider) });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROVIDER_NOT_READY') {
      return res.status(409).json({ error: 'PROVIDER_NOT_READY' });
    }
    throw error;
  }
});
