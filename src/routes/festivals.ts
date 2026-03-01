import { Router } from 'express';
import { getActiveFestivals } from '../controllers/festivalController';

const router = Router();

// GET /api/festivals/active
router.get('/active', getActiveFestivals);

export default router;
