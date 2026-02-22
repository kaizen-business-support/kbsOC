import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Paper,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  CloudUpload as UploadIcon,
  Analytics as AnalysisIcon,
  Assessment as ReportsIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Devices as MobileIcon,
  CheckCircle as CheckIcon,
  People as ClientIcon,
  AccountBalance as BankingIcon,
  Gavel as WorkflowIcon,
  Language as BilingualIcon,
  CompareArrows as BenchmarkIcon,
  BarChart as ScoringIcon,
  Assignment as DocumentIcon,
  Schedule as ProcessIcon,
} from '@mui/icons-material';
import { PageType } from '../types';
import optimusIcon from '../assets/Optimus_icon.png';

interface HomePageProps {
  onNavigate: (page: PageType) => void;
}

const creditFeatures = [
  {
    icon: ClientIcon,
    title: 'Gestion des Clients',
    description: 'Gestion complète des clients corporatifs avec intégration bancaire et traçabilité des actionnaires',
  },
  {
    icon: BankingIcon,
    title: 'Conformité SYSCOHADA',
    description: 'Traitement complet des états financiers selon les normes comptables OHADA',
  },
  {
    icon: ScoringIcon,
    title: 'Score Dual',
    description: 'Système de notation combinant analyse financière automatisée et appréciation des analystes',
  },
  {
    icon: BenchmarkIcon,
    title: 'Benchmarking Sectoriel',
    description: 'Comparaison avec les standards de l\'industrie et analyses de performance relative',
  },
  {
    icon: WorkflowIcon,
    title: 'Workflow Configurable',
    description: 'Processus d\'approbation flexible avec seuils configurables et routage automatique',
  },
  {
    icon: BilingualIcon,
    title: 'Interface Bilingue',
    description: 'Support complet Français/Anglais avec localisation adaptée au contexte bancaire',
  },
  {
    icon: DocumentIcon,
    title: 'Gestion Documentaire',
    description: 'OCR avancé, versioning et catégorisation des documents avec audit trail',
  },
  {
    icon: ProcessIcon,
    title: 'Suivi en Temps Réel',
    description: 'Monitoring des processus avec visualisation des workflows et notifications automatiques',
  },
];

const userRoles = [
  {
    role: 'Chargé d\'Affaires',
    description: 'Création de clients, saisie des données financières, évaluations qualitatives',
    color: 'primary',
  },
  {
    role: 'Analyste Crédit',
    description: 'Révision technique, notation analytique, comparaison sectorielle',
    color: 'secondary',
  },
  {
    role: 'Directeur d\'Agence',
    description: 'Approbation jusqu\'à 5M XOF, supervision des équipes, escalade',
    color: 'success',
  },
  {
    role: 'Comité de Crédit',
    description: 'Décisions finales pour montants >5M XOF, enregistrement des résolutions',
    color: 'warning',
  },
];

const workflowSteps = [
  'Création du client et gestion des actionnaires avec validation RCCM/TIN',
  'Saisie des états financiers SYSCOHADA complets sur 5 années',
  'Analyse automatique avec calcul des ratios et score financier',
  'Évaluation qualitative de l\'analyste avec score d\'appréciation',
  'Routage automatique selon les seuils d\'approbation configurables',
  'Génération de rapports complets avec recommandations',
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #D6DEE8 0%, #C4CDD9 100%)',
          color: '#1f4e79',
          py: 10,
          px: 4,
          borderRadius: 3,
          mb: 6,
          textAlign: 'center',
        }}
      >
        <Avatar
          sx={{
            width: 100,
            height: 100,
            bgcolor: 'transparent',
            mx: 'auto',
            mb: 4,
          }}
        >
          <img 
            src={optimusIcon}
            alt="OptimusCredit Logo" 
            style={{ 
              width: '70px',
              height: '70px'
            }}
          />
        </Avatar>
        
        <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          {t('home.title')}
        </Typography>
        
        <Typography variant="h4" component="h2" sx={{ mb: 4, opacity: 0.9 }}>
          {t('home.subtitle')}
        </Typography>
        
        <Typography variant="h6" sx={{ mb: 4, maxWidth: 900, mx: 'auto', opacity: 0.8 }}>
          {t('home.description')}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 4 }}>
          <Chip
            label={t('home.tags.syscohada')}
            sx={{ bgcolor: 'rgba(31,78,121,0.1)', color: '#1f4e79', fontWeight: 600, borderColor: '#1f4e79', border: '1px solid' }}
          />
          <Chip
            label={t('home.tags.bilingual')}
            sx={{ bgcolor: 'rgba(31,78,121,0.1)', color: '#1f4e79', fontWeight: 600, borderColor: '#1f4e79', border: '1px solid' }}
          />
          <Chip
            label={t('home.tags.multiRole')}
            sx={{ bgcolor: 'rgba(31,78,121,0.1)', color: '#1f4e79', fontWeight: 600, borderColor: '#1f4e79', border: '1px solid' }}
          />
          <Chip
            label={t('home.tags.dualScoring')}
            sx={{ bgcolor: 'rgba(31,78,121,0.1)', color: '#1f4e79', fontWeight: 600, borderColor: '#1f4e79', border: '1px solid' }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => onNavigate('clients')}
            sx={{
              bgcolor: '#1f4e79',
              color: 'white',
              px: 4,
              py: 2,
              fontSize: '1.1rem',
              fontWeight: 700,
              '&:hover': {
                bgcolor: '#1a3d5f',
              },
            }}
            startIcon={<ClientIcon />}
          >
            Processus Crédit
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => onNavigate('data-input')}
            sx={{
              borderColor: '#1f4e79',
              color: '#1f4e79',
              px: 4,
              py: 2,
              fontSize: '1.1rem',
              fontWeight: 700,
              '&:hover': {
                borderColor: '#1f4e79',
                bgcolor: 'rgba(31,78,121,0.1)',
              },
            }}
            startIcon={<AnalysisIcon />}
          >
            Analyse Simple
          </Button>
        </Box>
      </Box>

      {/* User Roles Section */}
      <Typography variant="h4" component="h2" gutterBottom sx={{ mb: 4, fontWeight: 600, textAlign: 'center' }}>
        {t('home.userRoles.title')}
      </Typography>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid item xs={12} md={6} lg={3}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
              background: 'linear-gradient(135deg, #D6DEE8 0%, #C4CDD9 100%)',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'primary.main',
                boxShadow: 3,
              },
            }}
            onClick={() => onNavigate('data-input')}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Chip
                label={t('home.userRoles.accountManager')}
                color="primary"
                sx={{ mb: 2, fontWeight: 600, fontSize: '0.9rem' }}
              />
              <Typography variant="body1" sx={{ px: 2, color: '#1f4e79' }}>
                {t('home.userRoles.accountManagerDesc')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
              background: 'linear-gradient(135deg, #D6DEE8 0%, #C4CDD9 100%)',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'primary.main',
                boxShadow: 3,
              },
            }}
            onClick={() => onNavigate('data-input')}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Chip
                label={t('home.userRoles.creditAnalyst')}
                color="secondary"
                sx={{ mb: 2, fontWeight: 600, fontSize: '0.9rem' }}
              />
              <Typography variant="body1" sx={{ px: 2, color: '#1f4e79' }}>
                {t('home.userRoles.creditAnalystDesc')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
              background: 'linear-gradient(135deg, #D6DEE8 0%, #C4CDD9 100%)',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'primary.main',
                boxShadow: 3,
              },
            }}
            onClick={() => onNavigate('data-input')}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Chip
                label={t('home.userRoles.branchManager')}
                color="success"
                sx={{ mb: 2, fontWeight: 600, fontSize: '0.9rem' }}
              />
              <Typography variant="body1" sx={{ px: 2, color: '#1f4e79' }}>
                {t('home.userRoles.branchManagerDesc')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid transparent',
              background: 'linear-gradient(135deg, #D6DEE8 0%, #C4CDD9 100%)',
              '&:hover': {
                transform: 'translateY(-4px)',
                borderColor: 'primary.main',
                boxShadow: 3,
              },
            }}
            onClick={() => onNavigate('data-input')}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Chip
                label={t('home.userRoles.creditCommittee')}
                color="warning"
                sx={{ mb: 2, fontWeight: 600, fontSize: '0.9rem' }}
              />
              <Typography variant="body1" sx={{ px: 2, color: '#1f4e79' }}>
                {t('home.userRoles.creditCommitteeDesc')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Features Section */}
      <Typography variant="h4" component="h2" gutterBottom sx={{ mb: 4, fontWeight: 600, textAlign: 'center' }}>
        {t('home.features.title')}
      </Typography>

      <Grid container spacing={4} sx={{ mb: 6 }}>
        {creditFeatures.map((feature, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
            <Paper
              elevation={2}
              sx={{
                p: 3,
                textAlign: 'center',
                height: '100%',
                transition: 'all 0.3s ease',
                background: 'linear-gradient(135deg, #D6DEE8 0%, #C4CDD9 100%)',
                '&:hover': {
                  elevation: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: '#1f4e79',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <feature.icon sx={{ fontSize: 32 }} />
              </Avatar>
              <Typography variant="h6" component="h3" gutterBottom fontWeight={600} sx={{ color: '#1f4e79' }}>
                {feature.title}
              </Typography>
              <Typography variant="body2" sx={{ color: '#1f4e79', opacity: 0.8 }}>
                {feature.description}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Credit Process Workflow Section */}
      <Card sx={{ p: 4, background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ mb: 4, fontWeight: 600, textAlign: 'center' }}>
          Processus de Crédit Intégré
        </Typography>

        <Typography variant="h6" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
          Workflow configurable avec approbations automatisées selon les seuils définis
        </Typography>

        <List>
          {workflowSteps.map((step, index) => (
            <React.Fragment key={index}>
              <ListItem sx={{ py: 3 }}>
                <ListItemIcon>
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: 'primary.main',
                      fontSize: '1rem',
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={step}
                  primaryTypographyProps={{
                    variant: 'body1',
                    sx: { fontWeight: 500, fontSize: '1.1rem' },
                  }}
                />
                <ProcessIcon sx={{ color: 'primary.main', ml: 2 }} />
              </ListItem>
              {index < workflowSteps.length - 1 && <Divider component="li" />}
            </React.Fragment>
          ))}
        </List>
      </Card>

      {/* Footer Information */}
      <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Conforme aux normes SYSCOHADA • Optimisé pour les banques sénégalaises • 
          Support technique disponible
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Version 2.0 - Système de Gestion de Processus Crédit
        </Typography>
      </Box>
    </Box>
  );
};