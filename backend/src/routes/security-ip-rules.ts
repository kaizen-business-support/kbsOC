import { Router, Request, Response } from 'express';
import { authorize } from '../middleware/auth';
import {
  listIpRules, createIpRule, updateIpRule, toggleIpRule, softDeleteIpRule,
  SecurityIpRuleError,
} from '../services/securityIpRulesService';

const router = Router();

router.use(authorize(['manage_security']));

function isSuperAdmin(req: Request): boolean {
  return req.user?.role === 'SUPER_ADMIN';
}

function isAdmin(req: Request): boolean {
  return req.user?.role === 'ADMIN' || isSuperAdmin(req);
}

function handle(res: Response, e: unknown) {
  if (e instanceof SecurityIpRuleError) {
    return res.status(e.status).json({ success: false, error: e.code, message: e.message });
  }
  console.error('[security-ip-rules]', e);
  return res.status(500).json({ success: false, error: 'internal', message: 'Erreur serveur' });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await listIpRules({
      companyId: req.user!.companyId ?? '',
      isAdmin: isAdmin(req),
      isSuperAdmin: isSuperAdmin(req),
      scope: (req.query.scope as any) ?? 'all',
      isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
      ruleType: req.query.ruleType as any,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : 0,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
    });
    res.json({ success: true, data });
  } catch (e) { handle(res, e); }
});

router.post('/', async (req: Request, res: Response) => {
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
    const created = await createIpRule({
      ipAddress: req.body.ipAddress,
      ruleType: req.body.ruleType,
      description: req.body.description,
      isActive: req.body.isActive,
      companyId,
      createdBy: req.user!.id,
    }, req.realIp ?? req.ip ?? '');
    res.status(201).json({ success: true, data: created });
  } catch (e) { handle(res, e); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await updateIpRule(req.params.id, {
      ipAddress: req.body.ipAddress,
      ruleType: req.body.ruleType,
      description: req.body.description,
      isActive: req.body.isActive,
    }, req.realIp ?? req.ip ?? '');
    res.json({ success: true, data: updated });
  } catch (e) { handle(res, e); }
});

router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const updated = await toggleIpRule(req.params.id, req.realIp ?? req.ip ?? '');
    res.json({ success: true, data: updated });
  } catch (e) { handle(res, e); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await softDeleteIpRule(req.params.id);
    res.json({ success: true, data: deleted });
  } catch (e) { handle(res, e); }
});

export default router;
