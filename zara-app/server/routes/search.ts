
import { Router } from 'express';
import { z } from 'zod';
import { searchMessagesPaginated } from '../db/repositories/messageRepository.js';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(500),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', (req, res) => {
  const validation = searchQuerySchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SEARCH_PARAMETERS',
      details: validation.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const { q, page, limit } = validation.data;

  try {
    const result = searchMessagesPaginated({
      query: q,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.results,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'INVALID_SEARCH_PAGE'
    ) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_SEARCH_PAGE',
      });
    }

    console.error('Search API error:', error);

    return res.status(500).json({
      success: false,
      error: 'SEARCH_FAILED',
    });
  }
});

export default router;
