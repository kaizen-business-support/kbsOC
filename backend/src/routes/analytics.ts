import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { calculateWorkingTime, formatWorkingDuration, WORKING_CONFIG } from '../utils/workingTime';

const router = Router();

// Interface for analytics data
interface WorkflowTimestamp {
  id: string;
  clientId: string;
  applicationNumber: string;
  branch: string;
  createdByName: string;
  status: string;
  finalDecision?: string;
  requestedAmount: number;
  totalStartedAt: string;
  totalDuration?: number;
  steps: Array<{
    stepName: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
  }>;
}

// GET /api/analytics/dashboard - Get dashboard analytics data
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { 
      branch, 
      manager, 
      timeRange, 
      startDate, 
      endDate 
    } = req.query;

    // Build date filter
    let dateFilter: any = {};
    if (timeRange && timeRange !== '') {
      const now = new Date();
      let filterStartDate: Date = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); // Default to 1 month

      switch (timeRange) {
        case '1month':
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '3months':
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case '6months':
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
          break;
        case '1year':
          filterStartDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case 'custom':
          if (startDate && endDate) {
            filterStartDate = new Date(startDate as string);
            const filterEndDate = new Date(endDate as string);
            filterEndDate.setHours(23, 59, 59, 999);
            dateFilter = {
              createdAt: {
                gte: filterStartDate,
                lte: filterEndDate
              }
            };
          }
          break;
        default:
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      }

      if (timeRange !== 'custom') {
        dateFilter = {
          createdAt: {
            gte: filterStartDate,
            lte: now
          }
        };
      }
    }

    // Build filters
    const whereClause: any = {
      ...dateFilter
    };

    // Branch filter
    if (branch && branch !== 'all') {
      whereClause.client = {
        creator: {
          department: branch
        }
      };
    }

    // Manager filter
    if (manager && manager !== 'all') {
      whereClause.creator = {
        name: manager
      };
    }

    // Get applications with related data
    const applications = await prisma.creditApplication.findMany({
      where: whereClause,
      include: {
        client: {
          include: {
            creator: true
          }
        },
        creator: true,
        workflowSteps: {
          orderBy: {
            createdAt: 'asc'
          },
          include: {
            assignee: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to WorkflowTimestamp format for frontend compatibility
    const workflowData: WorkflowTimestamp[] = applications.map(app => {
      // Sort workflow steps by creation date to ensure proper order
      const sortedSteps = app.workflowSteps.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Noms d'étapes de création qui ne se mesurent pas comme durée de traitement
      const CREATION_STEP_NAMES = new Set(['Application Créée', 'application_created', 'Demande Soumise']);

      const steps = sortedSteps.map((step, index) => {
        let duration: number | undefined = undefined;

        if (step.completedAt && !CREATION_STEP_NAMES.has(step.stepName)) {
          // Cherche la dernière étape complétée précédant celle-ci (peu importe son index)
          const previousCompleted = sortedSteps
            .slice(0, index)
            .filter(s => s.completedAt)
            .pop();

          if (previousCompleted && previousCompleted.completedAt) {
            // Durée = temps ouvré entre la fin de l'étape précédente et la fin de celle-ci
            const workingTime = calculateWorkingTime(previousCompleted.completedAt, step.completedAt);
            duration = workingTime.totalWorkingMinutes * 60 * 1000;
          } else {
            // Première étape mesurable : durée depuis la création du dossier
            const workingTime = calculateWorkingTime(new Date(app.createdAt), step.completedAt);
            duration = workingTime.totalWorkingMinutes * 60 * 1000;
          }
        }

        return {
          stepName: step.stepName === 'Application Créée' ? 'Demande Soumise' : step.stepName,
          status: step.status.toLowerCase(),
          startedAt: step.createdAt.toISOString(),
          completedAt: step.completedAt?.toISOString(),
          duration
        };
      });

      // Durée totale = temps ouvré depuis création jusqu'à la dernière étape complétée
      // Calculé pour APPROVED, REJECTED et DISBURSED
      let totalDuration: number | undefined = undefined;
      if (['APPROVED', 'REJECTED', 'DISBURSED'].includes(app.status)) {
        const lastCompletedStep = steps
          .filter(s => s.completedAt)
          .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];

        if (lastCompletedStep) {
          const totalWorkingTime = calculateWorkingTime(new Date(app.createdAt), new Date(lastCompletedStep.completedAt!));
          totalDuration = totalWorkingTime.totalWorkingMinutes * 60 * 1000;
        }
      }

      return {
        id: app.id,
        clientId: app.clientId,
        applicationNumber: app.applicationNumber,
        branch: app.client.creator.department || 'Non spécifié',
        createdByName: app.creator.name,
        status: app.status.toLowerCase(),
        finalDecision: (app.status === 'APPROVED' || app.status === 'DISBURSED') ? 'approved' :
                      app.status === 'REJECTED' ? 'rejected' : undefined,
        requestedAmount: Number(app.amount),
        totalStartedAt: app.createdAt.toISOString(),
        totalDuration,
        steps
      };
    });

    // Calculate summary statistics
    const totalApplications = workflowData.length;
    const totalApproved = workflowData.filter(w => w.status === 'approved').length;
    const totalRejected = workflowData.filter(w => w.status === 'rejected').length;
    const totalPending = totalApplications - totalApproved - totalRejected;
    const totalVolume = workflowData.reduce((sum, w) => sum + w.requestedAmount, 0);
    const approvalRate = totalApplications > 0 ? (totalApproved / totalApplications) * 100 : 0;

    // Calculate average processing time in working days
    const completedWorkflows = workflowData.filter(w => w.totalDuration);
    const avgProcessingTime = completedWorkflows.length > 0
      ? completedWorkflows.reduce((sum, w) => {
          // Convert milliseconds back to working minutes then to working days
          const workingMinutes = w.totalDuration! / (1000 * 60);
          const workingDays = workingMinutes / (WORKING_CONFIG.hoursPerDay * 60);
          return sum + workingDays;
        }, 0) / completedWorkflows.length
      : 0;
    const avgPerformance = avgProcessingTime > 0 ? Math.max(0, Math.min(100, 100 - (avgProcessingTime * 5))) : 0;

    res.json({
      success: true,
      data: {
        workflows: workflowData,
        summary: {
          totalApplications,
          totalApproved,
          totalRejected,
          totalPending,
          totalVolume,
          approvalRate,
          avgProcessingTime,
          avgPerformance
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des données analytiques',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/analytics/branches - Get branch performance data
router.get('/branches', async (req: Request, res: Response) => {
  try {
    const branches = await prisma.user.findMany({
      where: {
        department: { not: null },
        role: 'ACCOUNT_MANAGER'
      },
      select: {
        name: true,
        department: true,
        createdApplications: {
          select: {
            id: true,
            amount: true,
            status: true,
            workflowSteps: true
          }
        }
      }
    });

    const branchData = branches.map(branch => {
      const applications = branch.createdApplications;
      const approved = applications.filter(a => a.status === 'APPROVED').length;
      const total = applications.length;
      const volume = applications.reduce((sum, a) => sum + Number(a.amount), 0);
      
      return {
        branch: branch.department,
        manager: branch.name,
        applications: total,
        approved,
        rejected: applications.filter(a => a.status === 'REJECTED').length,
        pending: applications.filter(a => !['APPROVED', 'REJECTED'].includes(a.status)).length,
        volume,
        performance: total > 0 ? Math.round((approved / total) * 100) : 0
      };
    });

    res.json({
      success: true,
      data: branchData
    });
  } catch (error) {
    console.error('Branch analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des données de branches'
    });
  }
});

// GET /api/analytics/managers - Get account manager performance data  
router.get('/managers', async (req: Request, res: Response) => {
  try {
    const { branch } = req.query;
    
    const whereClause: any = {
      role: 'ACCOUNT_MANAGER'
    };
    
    if (branch && branch !== 'all') {
      whereClause.department = branch;
    }

    const managers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        department: true,
        createdApplications: {
          select: {
            id: true,
            amount: true,
            status: true,
            clientId: true,
            workflowSteps: {
              select: {
                createdAt: true,
                completedAt: true
              }
            }
          }
        },
        createdClients: {
          select: {
            id: true
          }
        }
      }
    });

    const managerData = managers.map(manager => {
      const applications = manager.createdApplications;
      const approved = applications.filter(a => a.status === 'APPROVED').length;
      const volume = applications.reduce((sum, a) => sum + Number(a.amount), 0);
      
      // Calculate average processing time using working time
      const completedApps = applications.filter(a => a.workflowSteps.length > 0);
      let totalWorkingTime = 0;
      let completedCount = 0;
      
      completedApps.forEach(app => {
        const firstStep = app.workflowSteps[0];
        const lastStep = app.workflowSteps[app.workflowSteps.length - 1];
        if (firstStep && lastStep && lastStep.completedAt) {
          const workingTime = calculateWorkingTime(firstStep.createdAt, lastStep.completedAt);
          totalWorkingTime += workingTime.workingDays;
          completedCount++;
        }
      });
      
      const avgProcessingTime = completedCount > 0 ? totalWorkingTime / completedCount : 0;
      const performance = avgProcessingTime > 0 
        ? Math.max(0, Math.min(100, 100 - (avgProcessingTime * 5)))
        : 50;
      
      return {
        name: manager.name,
        branch: manager.department,
        clients: manager.createdClients.length,
        applications: applications.length,
        approved,
        volume,
        performance: Math.round(performance)
      };
    });

    res.json({
      success: true,
      data: managerData
    });
  } catch (error) {
    console.error('Manager analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des données de chargés d\'affaires'
    });
  }
});

export default router;