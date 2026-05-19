import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Container,
  Fade
} from '@mui/material';
import {
  AccountBalanceWalletRounded as PortfolioIcon,
  WarningRounded as NplIcon,
  TimelineRounded as OperationsIcon,
  EventRepeatRounded as ScheduleIcon,
  TrendingUpRounded as PerformanceIcon,
  DescriptionRounded as DocumentIcon,
  AssessmentRounded as AssessmentIcon
} from '@mui/icons-material';
import { PageType } from '../types';
import { DynamicReportViewer } from '../components/reports/DynamicReportViewer';

// Import all configurations
import { loanPortfolioReportConfig } from '../config/reports/loanPortfolioReportConfig';
import { nplReportConfig } from '../config/reports/nplReportConfig';
import { disbursementsReportConfig } from '../config/reports/disbursementsReportConfig';
import { repaymentScheduleReportConfig } from '../config/reports/repaymentScheduleReportConfig';
import { interestAccrualReportConfig } from '../config/reports/interestAccrualReportConfig';
import { creditScoringStatsReportConfig } from '../config/reports/creditScoringStatsReportConfig';
import { ReportConfig } from '../types/reports';

interface CreditReportsMenuProps {
  onNavigate: (page: PageType) => void;
}

// All available reports mapping.
// Currently all 6 reports are pending real data integration — kept empty so they
// display the "Bientôt disponible" badge. Re-add an entry here when its backend
// data source is wired up.
const availableReports: Record<string, ReportConfig> = {};
void loanPortfolioReportConfig;
void nplReportConfig;
void disbursementsReportConfig;
void repaymentScheduleReportConfig;
void interestAccrualReportConfig;
void creditScoringStatsReportConfig;

const reportCategories = [
  {
    title: 'Portefeuille de Crédits',
    reports: [
      { id: 'loan_portfolio', title: 'Analyse du Portefeuille', description: 'Vue d\'ensemble des crédits par produit, agence et statut.', icon: PortfolioIcon, color: '#0EA5E9', bgGradient: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)' },
      { id: 'npl_report', title: 'Créances Douteuses (NPL)', description: 'Suivi des prêts non performants et provisions.', icon: NplIcon, color: '#F43F5E', bgGradient: 'linear-gradient(135deg, #FFE4E6 0%, #FECDD3 100%)' },
    ]
  },
  {
    title: 'Opérations & Décaissements',
    reports: [
      { id: 'disbursements', title: 'Historique des Décaissements', description: 'Suivi des montants décaissés sur la période.', icon: OperationsIcon, color: '#10B981', bgGradient: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)' },
      { id: 'repayment_schedule', title: 'Échéanciers de Remboursement', description: 'Projections des flux de trésorerie entrants.', icon: ScheduleIcon, color: '#F59E0B', bgGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' },
    ]
  },
  {
    title: 'Performance & Rentabilité',
    reports: [
      { id: 'interest_accrual', title: 'Intérêts Courus et Perçus', description: 'Analyse de la rentabilité du portefeuille.', icon: PerformanceIcon, color: '#8B5CF6', bgGradient: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)' },
      { id: 'credit_scoring_stats', title: 'Statistiques de Scoring', description: 'Analyse de la distribution des scores de crédit.', icon: AssessmentIcon, color: '#3B82F6', bgGradient: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)' },
    ]
  }
];

export const CreditReportsMenu: React.FC<CreditReportsMenuProps> = ({ onNavigate }) => {
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const handleReportClick = (id: string) => {
    if (availableReports[id]) {
      setActiveReportId(id);
    } else {
      alert("Ce rapport est en cours de développement.");
    }
  };

  if (activeReportId && availableReports[activeReportId]) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Fade in={true} timeout={400}>
          <Box>
            <DynamicReportViewer 
              config={availableReports[activeReportId]} 
              onBack={() => setActiveReportId(null)} 
            />
          </Box>
        </Fade>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      <Fade in={true} timeout={500}>
        <Box>
          <Box sx={{ mb: 6 }}>
            <Typography variant="h4" fontWeight={800} sx={{ color: '#1E293B', mb: 1.5, letterSpacing: '-0.5px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              Centre de Rapports
            </Typography>
            <Typography variant="body1" sx={{ color: '#64748B', fontSize: '1.1rem', maxWidth: '800px', lineHeight: 1.6 }}>
              Générez des rapports interactifs et détaillés sur les performances, les opérations et la santé globale de votre portefeuille de crédit.
            </Typography>
          </Box>

          {reportCategories.map((category, idx) => (
            <Box key={idx} sx={{ mb: 6 }}>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#334155', mb: 2.5, display: 'flex', alignItems: 'center', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                <DocumentIcon sx={{ mr: 1.5, fontSize: 24, color: '#94A3B8' }} />
                {category.title}
              </Typography>
              
              <Grid container spacing={3}>
                {category.reports.map((report) => {
                  const Icon = report.icon;
                  const isAvailable = !!availableReports[report.id];
                  return (
                    <Grid item xs={12} sm={6} md={4} key={report.id}>
                      <Card 
                        elevation={0}
                        sx={{ 
                          height: '100%',
                          borderRadius: '24px',
                          border: '1px solid #F1F5F9',
                          background: '#FFFFFF',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative',
                          overflow: 'hidden',
                          opacity: isAvailable ? 1 : 0.6,
                          '&:hover': isAvailable ? {
                            transform: 'translateY(-6px)',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                            borderColor: '#E2E8F0',
                            '& .report-icon-wrapper': {
                              transform: 'scale(1.05)',
                            }
                          } : {}
                        }}
                      >
                        <CardActionArea 
                          onClick={() => handleReportClick(report.id)}
                          sx={{ height: '100%', p: 3 }}
                          disabled={!isAvailable && false}
                        >
                          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2.5 }}>
                              <Avatar 
                                className="report-icon-wrapper"
                                sx={{ 
                                  background: report.bgGradient,
                                  color: report.color,
                                  width: 56, 
                                  height: 56,
                                  mr: 2.5,
                                  borderRadius: '16px',
                                  transition: 'transform 0.3s ease',
                                  boxShadow: `0 8px 16px -4px ${report.color}40`
                                }}
                              >
                                <Icon sx={{ fontSize: 28 }} />
                              </Avatar>
                              <Box sx={{ pt: 0.5 }}>
                                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.15rem', color: '#0F172A', lineHeight: 1.3, mb: 0.75, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                                  {report.title}
                                </Typography>
                                {!isAvailable && (
                                  <Typography variant="caption" sx={{ color: '#D97706', fontWeight: 600, bgcolor: '#FEF3C7', px: 1.5, py: 0.5, borderRadius: '8px', display: 'inline-block' }}>
                                    Bientôt disponible
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                            <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6, fontSize: '0.95rem' }}>
                              {report.description}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          ))}
        </Box>
      </Fade>
    </Container>
  );
};
