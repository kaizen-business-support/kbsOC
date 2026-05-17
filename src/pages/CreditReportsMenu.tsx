import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Divider,
  Container
} from '@mui/material';
import {
  AccountBalanceWallet as PortfolioIcon,
  WarningAmber as NplIcon,
  Timeline as OperationsIcon,
  EventNote as ScheduleIcon,
  TrendingUp as PerformanceIcon,
  Description as DocumentIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { PageType } from '../types';
import { DynamicReportViewer } from '../components/reports/DynamicReportViewer';

// Import our configuration mocks
import { loanPortfolioReportConfig } from '../config/reports/loanPortfolioReportConfig';
import { ReportConfig } from '../types/reports';

interface CreditReportsMenuProps {
  onNavigate: (page: PageType) => void;
}

// All available reports mapping
const availableReports: Record<string, ReportConfig> = {
  'loan_portfolio': loanPortfolioReportConfig,
  // We can add others here later
};

const reportCategories = [
  {
    title: 'Portefeuille de Crédits',
    reports: [
      { id: 'loan_portfolio', title: 'Analyse du Portefeuille', description: 'Vue d\'ensemble des crédits par produit, agence et statut.', icon: PortfolioIcon, color: '#1F4E79' },
      { id: 'npl_report', title: 'Créances Douteuses (NPL)', description: 'Suivi des prêts non performants et provisions.', icon: NplIcon, color: '#EF4444' },
    ]
  },
  {
    title: 'Opérations & Décaissements',
    reports: [
      { id: 'disbursements', title: 'Historique des Décaissements', description: 'Suivi des montants décaissés sur la période.', icon: OperationsIcon, color: '#10B981' },
      { id: 'repayment_schedule', title: 'Échéanciers de Remboursement', description: 'Projections des flux de trésorerie entrants.', icon: ScheduleIcon, color: '#F59E0B' },
    ]
  },
  {
    title: 'Performance & Rentabilité',
    reports: [
      { id: 'interest_accrual', title: 'Intérêts Courus et Perçus', description: 'Analyse de la rentabilité du portefeuille.', icon: PerformanceIcon, color: '#8B5CF6' },
      { id: 'credit_scoring_stats', title: 'Statistiques de Scoring', description: 'Analyse de la distribution des scores de crédit.', icon: AssessmentIcon, color: '#3B82F6' },
    ]
  }
];

export const CreditReportsMenu: React.FC<CreditReportsMenuProps> = ({ onNavigate }) => {
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const handleReportClick = (id: string) => {
    // For now, only the 'loan_portfolio' report has a config
    if (availableReports[id]) {
      setActiveReportId(id);
    } else {
      alert("Ce rapport est en cours de développement.");
    }
  };

  if (activeReportId && availableReports[activeReportId]) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <DynamicReportViewer 
          config={availableReports[activeReportId]} 
          onBack={() => setActiveReportId(null)} 
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8, animation: 'fadeIn 0.5s ease-in-out' }}>
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', mb: 1, letterSpacing: '-0.5px' }}>
          Centre de Rapports Crédit
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Générez des rapports détaillés sur les performances, les opérations et la santé du portefeuille de crédit.
        </Typography>
      </Box>

      {reportCategories.map((category, idx) => (
        <Box key={idx} sx={{ mb: 5 }}>
          <Typography variant="h6" fontWeight={700} sx={{ color: 'primary.main', mb: 2, display: 'flex', alignItems: 'center' }}>
            <DocumentIcon sx={{ mr: 1, fontSize: 22 }} />
            {category.title}
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            {category.reports.map((report) => {
              const Icon = report.icon;
              const isAvailable = !!availableReports[report.id];
              return (
                <Grid item xs={12} sm={6} md={4} key={report.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      borderRadius: '16px',
                      border: 1,
                      borderColor: 'divider',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s ease-in-out',
                      opacity: isAvailable ? 1 : 0.6,
                      '&:hover': isAvailable ? {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        borderColor: 'primary.main'
                      } : {}
                    }}
                  >
                    <CardActionArea 
                      onClick={() => handleReportClick(report.id)}
                      sx={{ height: '100%', p: 2 }}
                      disabled={!isAvailable && false} // keep clickable to show alert
                    >
                      <CardContent sx={{ p: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                          <Avatar 
                            sx={{ 
                              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : `${report.color}15`, 
                              color: (theme) => theme.palette.mode === 'dark' ? '#FFF' : report.color,
                              width: 48, 
                              height: 48,
                              mr: 2,
                              borderRadius: '12px'
                            }}
                          >
                            <Icon />
                          </Avatar>
                          <Box>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem', color: 'text.primary', lineHeight: 1.2, mb: 0.5 }}>
                              {report.title}
                            </Typography>
                            {!isAvailable && (
                              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 600, bgcolor: '#FFFBEB', px: 1, py: 0.5, borderRadius: '4px' }}>
                                Bientôt disponible
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
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
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Container>
  );
};
