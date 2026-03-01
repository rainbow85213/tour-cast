import { Router } from 'express';
import { getSpotWithAccommodations } from '../controllers/spotController';

const router = Router();

// GET /api/spots/:id/with-accommodations
router.get('/:id/with-accommodations', getSpotWithAccommodations);

export default router;
