import { Router } from 'express';
import { getSpotWithAccommodations } from '../controllers/spotController';
import { cacheMiddleware } from '../middlewares/cache';

const router = Router();

const TWELVE_HOURS = 12 * 60 * 60;

// GET /api/spots/:id/with-accommodations
router.get(
  '/:id/with-accommodations',
  cacheMiddleware((req) => `cache:spot:${req.params.id}:with-accommodations`, TWELVE_HOURS),
  getSpotWithAccommodations,
);

export default router;
