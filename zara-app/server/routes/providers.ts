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

export const providerRouter = Router();

function serializeProvider(provider: Provider) {
  return {
    id: provider.id,
    name: provider.name,
    status: provider.status,
    enabled: provider.enabled,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
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
  try {
    initializeProviderAdapters();
    const models = await verifyProvider(id);
    if (models.length === 0) return res.status(502).json({ error: 'PROVIDER_NO_MODELS_RETURNED' });
    const model = (id === 'omniroute' ? process.env.OMNIROUTE_MODEL : process.env.FREELLMAPI_MODEL)?.trim();
    if (!model) return res.status(400).json({ error: 'PROVIDER_MODEL_NOT_CONFIGURED', models });
    if (model !== 'auto' && !models.includes(model)) {
      return res.status(400).json({ error: 'PROVIDER_MODEL_NOT_AVAILABLE', models });
    }
    const provider = markProviderReadyAfterVerification(id);
    return res.status(200).json({ provider: provider ? serializeProvider(provider) : null, modelCount: models.length, models });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PROVIDER_VERIFICATION_FAILED';
    return res.status(502).json({ error: code });
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
