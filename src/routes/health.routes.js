import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from '../controllers/health.controller.js';

const router = Router();

// Full health inspection (DB check, memory, latency)
router.get('/', getHealth);

// Liveness probe (Kubernetes / load-balancer keep-alive)
router.get('/live', getLiveness);

// Readiness probe (Database connectivity verification)
router.get('/ready', getReadiness);

export default router;

