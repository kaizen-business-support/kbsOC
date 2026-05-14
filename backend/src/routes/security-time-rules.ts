import { Router, Request, Response } from 'express';
import { authorize } from '../middleware/auth';
import { prisma } from '../prismaClient';
import {
  listTimeRules, createTimeRule, updateTimeRule, toggleTimeRule, softDeleteTimeRule,
  SecurityTimeRuleError,
} from '../services/securityTimeRulesService';
import { nextWindows } from '../services/timeRuleMatcher';

const router = Router();
router.use(authorize(['manage_security']));

function isSuperAdmin(req: Request): boolean { return req.user?.role === 'SUPER_ADMIN'; }
function isAdmin(req: Request): boolean { return req.user?.role === 'ADMIN' || isSuperAdmin(req); }

function handle(res: Response, e: unknown) {
  if (e instanceof SecurityTimeRuleError) {
    return res.status(e.status).json({ success: false, error: e.code, message: e.message });
  }
  console.error('[security-time-rules]', e);
  return res.status(500).json({ success: false, error: 'internal', message: 'Erreur serveur' });
}

router.get('/', async (req, res) => {
  try {
    const data = await listTimeRules({
      companyId: req.user!.companyId ?? '',
      isAdmin: isAdmin(req),
      isSuperAdmin: isSuperAdmin(req),
      scope: (req.query.scope as any) ?? 'all',
      isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      appliesTo: req.query.appliesTo as any,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : 0,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
    });
    res.json({ success: true, data });
  } catch (e) { handle(res, e); }
});

router.post('/', async (req, res) => {
  try {
    const wantsPlatform = req.body.companyId === null;
    if (wantsPlatform && !isSuperAdmin(req)) {
      return res.status(403).json({
        success: false, error: 'forbidden_platform_scope',
        message: 'Seul SUPER_ADMIN peut créer une règle plateforme',
      });
    }
    const companyId = wantsPlatform ? null : (req.user!.companyId ?? null);
    if (!wantsPlatform && !companyId) {
      return res.status(400).json({
        success: false, error: 'missing_tenant',
        message: 'companyId requis pour une règle non-plateforme',
      });
    }
    const created = await createTimeRule({
      name: req.body.name,
      daysOfWeek: req.body.daysOfWeek,
      timeStart: req.body.timeStart,
      timeEnd: req.body.timeEnd,
      timezone: req.body.timezone,
      appliesTo: req.body.appliesTo,
      targetValues: req.body.targetValues ?? [],
      deniedMessage: req.body.deniedMessage,
      isActive: req.body.isActive,
      companyId,
      createdBy: req.user!.id,
    });
    res.status(201).json({ success: true, data: created });
  } catch (e) { handle(res, e); }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await updateTimeRule(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (e) { handle(res, e); }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const updated = await toggleTimeRule(req.params.id);
    res.json({ success: true, data: updated });
  } catch (e) { handle(res, e); }
});

router.delete('/:id', async (req, res) => {
  try {
    const out = await softDeleteTimeRule(req.params.id);
    res.json({ success: true, data: out });
  } catch (e) { handle(res, e); }
});

router.get('/:id/preview', async (req, res) => {
  try {
    const rule = await prisma.securityTimeRule.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Règle introuvable' });
    }
    const preview = nextWindows({
      id: rule.id,
      daysOfWeek: rule.daysOfWeek,
      timeStart: rule.timeStart,
      timeEnd: rule.timeEnd,
      timezone: rule.timezone,
      appliesTo: rule.appliesTo,
      targetValues: rule.targetValues,
    }, new Date(), 7);
    res.json({
      success: true,
      data: { rule: { id: rule.id, name: rule.name, timezone: rule.timezone }, preview },
    });
  } catch (e) { handle(res, e); }
});

export default router;
