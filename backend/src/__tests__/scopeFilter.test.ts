/**
 * Integration tests for scopeFilter middleware.
 * Tests the branchFilter composition logic using mocked Prisma.
 */

// Mock prisma before importing middleware
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();

jest.mock('../prismaClient', () => ({
  prisma: {
    moduleProfile: { findUnique: (...args: any[]) => mockFindUnique(...args) },
    userModuleOverride: { findUnique: (...args: any[]) => mockFindUnique(...args) },
    scopeDelegate: { findFirst: (...args: any[]) => mockFindFirst(...args) },
  },
}));

import { Request, Response, NextFunction } from 'express';
import { scopeFilter } from '../middleware/scopeFilter';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: {
      id: 'user-1',
      companyId: 'company-1',
      role: 'CHARGE_AFFAIRES',
      branch: 'branch-home',
    } as any,
    ...overrides,
  } as unknown as Request;
}

const res = {} as Response;
const next: NextFunction = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (next as jest.Mock).mockReset();
});

describe('scopeFilter', () => {
  it('BRANCH_ONLY sans override ni délégation → filtre sur la branche de l\'utilisateur', async () => {
    // roleProfile: BRANCH_ONLY, no allowedBranches
    mockFindUnique
      .mockResolvedValueOnce({ defaultScope: 'BRANCH_ONLY', allowedBranches: [] }) // moduleProfile
      .mockResolvedValueOnce(null); // userModuleOverride
    mockFindFirst.mockResolvedValueOnce(null); // no delegation

    const req = makeReq();
    await scopeFilter(req, res, next);

    expect(req.branchFilter).toEqual({ branchId: { in: ['branch-home'] } });
    expect(next).toHaveBeenCalled();
  });

  it('ALL_BRANCHES via roleProfile → branchFilter vide (accès total)', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ defaultScope: 'ALL_BRANCHES', allowedBranches: [] })
      .mockResolvedValueOnce(null);
    mockFindFirst.mockResolvedValueOnce(null);

    const req = makeReq();
    await scopeFilter(req, res, next);

    expect(req.branchFilter).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  it('override utilisateur MULTI_BRANCH avec liste d\'agences → filtre sur ces agences', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ defaultScope: 'BRANCH_ONLY', allowedBranches: [] }) // moduleProfile
      .mockResolvedValueOnce({ dataScope: 'MULTI_BRANCH', allowedBranches: ['br-1', 'br-2'] }); // userOverride
    mockFindFirst.mockResolvedValueOnce(null);

    const req = makeReq();
    await scopeFilter(req, res, next);

    expect(req.branchFilter).toEqual({ branchId: { in: ['br-1', 'br-2'] } });
    expect(next).toHaveBeenCalled();
  });

  it('délégation ALL_BRANCHES élargit un scope BRANCH_ONLY → branchFilter vide', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ defaultScope: 'BRANCH_ONLY', allowedBranches: [] })
      .mockResolvedValueOnce(null);
    mockFindFirst.mockResolvedValueOnce({
      scope: 'ALL_BRANCHES',
      allowedBranches: [],
    });

    const req = makeReq();
    await scopeFilter(req, res, next);

    expect(req.branchFilter).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  it('erreur DB → fail-open (branchFilter vide, next appelé)', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB timeout'));

    const req = makeReq();
    await scopeFilter(req, res, next);

    expect(req.branchFilter).toEqual({});
    expect(next).toHaveBeenCalled();
  });
});
