/**
 * auth-docker.ts — DISABLED
 *
 * This file previously contained a Remote Code Execution vulnerability via
 * child_process.exec() (docker exec) and hardcoded credentials.
 * It has been neutralised and is no longer registered in server.ts.
 *
 * DO NOT restore or re-enable this file in any environment.
 */

import express from 'express';
const router = express.Router();

// All routes disabled — use /api/auth (auth.ts) instead
router.all('*', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'This authentication endpoint has been decommissioned. Use /api/auth.'
  });
});

export default router;
