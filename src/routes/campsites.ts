import { Router } from 'express';
import { getCampsites } from '../controllers/campController';

const router = Router();

// GET /api/campsites
router.get('/', getCampsites);

export default router;
