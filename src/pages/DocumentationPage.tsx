import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link,
  Button,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Assessment as AnalysisIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as BankIcon,
  CheckCircle as CheckIcon,
  Calculate as CalculateIcon,
  Source as SourceIcon,
  Gavel as ComplianceIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PictureAsPdf as PdfIcon,
  NewReleases as NewReleasesIcon,
  Security as SecurityIcon,
  ThumbsUpDown as ThumbsUpDownIcon,
  Insights as InsightsIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { PageType } from '../types';

interface DocumentationPageProps {
  onNavigate: (page: PageType) => void;
}

// Ratio calculation formulas and explanations
const liquidityRatios = [
  {
    name: "Liquidité Générale",
    formula: "(Actif Circulant + Trésorerie Actif) / Total Dettes",
    interpretation: "Capacité à honorer les dettes à court terme. Norme BCEAO : ≥ 1,2",
    excellent: "> 2,0",
    good: "1,5 - 2,0",
    acceptable: "1,2 - 1,5",
    poor: "1,0 - 1,2",
    critical: "< 1,0"
  },
  {
    name: "Liquidité Immédiate",
    formula: "Trésorerie Actif / Total Dettes",
    interpretation: "Capacité à honorer immédiatement les dettes. Norme BCEAO : ≥ 0,3",
    excellent: "> 0,8",
    good: "0,5 - 0,8",
    acceptable: "0,3 - 0,5",
    poor: "0,2 - 0,3",
    critical: "< 0,2"
  },
  {
    name: "BFR en jours de CA",
    formula: "(BFR / Chiffre d'Affaires) × 365",
    interpretation: "Nombre de jours de CA nécessaires pour financer le BFR. Objectif : < 60 jours",
    excellent: "< 30 jours",
    good: "30 - 45 jours",
    acceptable: "45 - 60 jours",
    poor: "60 - 90 jours",
    critical: "> 90 jours"
  }
];

const solvabilityRatios = [
  {
    name: "Autonomie Financière",
    formula: "(Capitaux Propres / Total Actif) × 100",
    interpretation: "Indépendance financière de l'entreprise. Norme BCEAO : ≥ 20%",
    excellent: "> 40%",
    good: "30% - 40%",
    acceptable: "20% - 30%",
    poor: "10% - 20%",
    critical: "< 10%"
  },
  {
    name: "Endettement Global",
    formula: "(Total Dettes / Total Actif) × 100",
    interpretation: "Niveau d'endettement global. Norme BCEAO : ≤ 70%",
    excellent: "< 40%",
    good: "40% - 50%",
    acceptable: "50% - 70%",
    poor: "70% - 85%",
    critical: "> 85%"
  }
];

const profitabilityRatios = [
  {
    name: "ROE (Return on Equity)",
    formula: "(Résultat Net / Capitaux Propres) × 100",
    interpretation: "Rentabilité des capitaux propres. Norme BCEAO : ≥ 10%",
    excellent: "> 20%",
    good: "15% - 20%",
    acceptable: "10% - 15%",
    poor: "5% - 10%",
    critical: "< 5%"
  },
  {
    name: "ROA (Return on Assets)",
    formula: "(Résultat Net / Total Actif) × 100",
    interpretation: "Rentabilité économique des actifs. Norme BCEAO : ≥ 5%",
    excellent: "> 10%",
    good: "7% - 10%",
    acceptable: "5% - 7%",
    poor: "2% - 5%",
    critical: "< 2%"
  },
  {
    name: "Marge Nette",
    formula: "(Résultat Net / Chiffre d'Affaires) × 100",
    interpretation: "Rentabilité commerciale. Norme BCEAO : ≥ 3%",
    excellent: "> 8%",
    good: "5% - 8%",
    acceptable: "3% - 5%",
    poor: "1% - 3%",
    critical: "< 1%"
  }
];

const sectoralReferences = [
  {
    sector: "Commerce",
    source: "BCEAO - Rapport Conditions de Banque UEMOA 2023",
    link: "https://www.bceao.int/fr/publications/rapport-sur-les-conditions-de-banque-dans-luemoa-2023",
    downloadLink: "/docs/BCEAO_Conditions_Banque_UEMOA_2023.pdf",
    liquidite_generale: "1,0 - 1,5",
    autonomie_financiere: "20% - 35%",
    roe: "12% - 20%",
    rotation_actif: "1,2 - 2,0"
  },
  {
    sector: "Industrie",
    source: "BCEAO - Commission Bancaire UMOA 2023",
    link: "https://www.bceao.int/fr/publications/rapport-annuel-de-la-commission-bancaire-de-lumoa-2023",
    downloadLink: "/docs/BCEAO_Commission_Bancaire_UMOA_2023.pdf",
    liquidite_generale: "1,2 - 1,8",
    autonomie_financiere: "25% - 45%",
    roe: "8% - 15%",
    rotation_actif: "0,8 - 1,2"
  },
  {
    sector: "Services",
    source: "FMI - Guide de Compilation des ISF 2019",
    link: "https://www.imf.org/en/Data/Statistics/FSI-guide",
    downloadLink: "/docs/FMI_Guide_ISF_2019.pdf",
    liquidite_generale: "1,5 - 2,5",
    autonomie_financiere: "30% - 60%",
    roe: "15% - 25%",
    rotation_actif: "1,0 - 1,8"
  },
  {
    sector: "Agriculture",
    source: "Banque Mondiale - Manuel Enquêtes Entreprises",
    link: "https://www.enterprisesurveys.org/en/data",
    downloadLink: "/docs/WorldBank_Enterprise_Surveys_Manual.pdf",
    liquidite_generale: "1,3 - 2,0",
    autonomie_financiere: "35% - 55%",
    roe: "10% - 18%",
    rotation_actif: "0,6 - 1,0"
  }
];

const soldesIntermediaires = [
  {
    name: "Marge Commerciale",
    formula: "Ventes de marchandises - Coût d'achat des marchandises vendues",
    description: "La marge commerciale représente le bénéfice réalisé uniquement sur l'activité de revente de marchandises, sans aucune transformation. Elle indique combien l'entreprise gagne en achetant des produits finis pour les revendre en l'état.",
    example: "Une épicerie achète des boîtes de conserve à 100 FCFA et les revend 150 FCFA. Si elle en vend 1000 par mois, sa marge commerciale sera : (150 x 1000) - (100 x 1000) = 50 000 FCFA. Cette marge doit couvrir les frais de magasin, salaires, et générer un bénéfice."
  },
  {
    name: "Production de l'exercice",
    formula: "Production vendue + Production stockée + Production immobilisée",
    description: "Cet indicateur mesure la valeur totale de ce que l'entreprise a produit pendant l'année, qu'elle l'ait vendu immédiatement, stocké pour vendre plus tard, ou gardé pour ses propres besoins. Il reflète l'activité productive réelle de l'entreprise.",
    example: "Une boulangerie fabrique du pain pour 2 000 000 FCFA/mois qu'elle vend, stocke 200 000 FCFA de pâtisseries pour les fêtes, et fabrique ses propres étagères pour 100 000 FCFA. Sa production totale = 2 300 000 FCFA/mois. Cela montre sa capacité productive réelle."
  },
  {
    name: "Valeur Ajoutée",
    formula: "Marge commerciale + Production - Consommations intermédiaires",
    description: "La valeur ajoutée représente la richesse nouvelle créée par l'entreprise grâce à son activité. C'est la différence entre ce qu'elle produit/vend et ce qu'elle achète à d'autres entreprises. Plus la valeur ajoutée est élevée, plus l'entreprise apporte de valeur à l'économie.",
    example: "Un menuisier vend des tables à 100 000 FCFA. Il achète le bois à 30 000 FCFA, la quincaillerie à 10 000 FCFA. Sa valeur ajoutée par table = 100 000 - (30 000 + 10 000) = 60 000 FCFA. Ces 60 000 FCFA représentent la valeur de son savoir-faire, son travail et ses outils."
  },
  {
    name: "Excédent Brut d'Exploitation (EBE)",
    formula: "Valeur ajoutée - Charges de personnel - Impôts et taxes",
    description: "L'EBE mesure ce que l'entreprise génère comme excédent après avoir payé ses employés et les impôts, mais avant de rembourser ses emprunts ou amortir ses équipements. C'est l'indicateur clé de la rentabilité opérationnelle pure de l'entreprise.",
    example: "Un garage automobile génère 5 000 000 FCFA de valeur ajoutée. Il paie 2 000 000 FCFA de salaires et 300 000 FCFA d'impôts. Son EBE = 5 000 000 - 2 000 000 - 300 000 = 2 700 000 FCFA. Cette somme servira à rembourser les emprunts, renouveler les équipements et dégager un bénéfice."
  },
  {
    name: "Résultat d'Exploitation",
    formula: "EBE - Dotations aux amortissements et provisions",
    description: "Le résultat d'exploitation indique le bénéfice généré par l'activité principale de l'entreprise, après avoir pris en compte l'usure et la dépréciation des équipements. Il montre si le cœur de métier de l'entreprise est rentable, indépendamment du financement ou des éléments exceptionnels.",
    example: "Une imprimerie a un EBE de 1 500 000 FCFA. Ses machines s'usent et perdent 400 000 FCFA de valeur par an (amortissement). Son résultat d'exploitation = 1 500 000 - 400 000 = 1 100 000 FCFA. Ce montant montre que son activité d'impression est rentable même après usure des machines."
  },
  {
    name: "Résultat Courant",
    formula: "Résultat d'exploitation + Résultat financier",
    description: "Le résultat courant combine la performance opérationnelle de l'entreprise avec sa politique financière (emprunts, placements). Il représente le bénéfice des activités normales et récurrentes, excluant les événements exceptionnels. C'est un indicateur de la rentabilité globale habituelle.",
    example: "Un hôtel a un résultat d'exploitation de 2 000 000 FCFA. Il paie 300 000 FCFA d'intérêts sur ses emprunts et reçoit 50 000 FCFA d'intérêts sur ses placements. Résultat financier = 50 000 - 300 000 = -250 000 FCFA. Résultat courant = 2 000 000 - 250 000 = 1 750 000 FCFA."
  },
  {
    name: "Résultat Net",
    formula: "Résultat courant + Résultat exceptionnel - Impôts sur bénéfices",
    description: "Le résultat net est le bénéfice final qui revient aux propriétaires de l'entreprise après tous les coûts, impôts et événements exceptionnels. C'est l'indicateur ultime de la rentabilité : ce qui reste réellement dans les poches des actionnaires ou pour autofinancer l'entreprise.",
    example: "Un restaurant a un résultat courant de 800 000 FCFA. Il vend un ancien four pour un bénéfice exceptionnel de 100 000 FCFA et paie 180 000 FCFA d'impôts sur les bénéfices. Son résultat net = 800 000 + 100 000 - 180 000 = 720 000 FCFA. Cette somme peut être distribuée aux associés ou réinvestie."
  }
];

const bceaoNorms = [
  {
    category: "Institutions de Microfinance",
    ratios: [
      { name: "Ratio de solvabilité", norme: "≥ 15%", description: "Fonds propres / Total bilan" },
      { name: "Ratio de liquidité", norme: "≥ 15%", description: "Actifs liquides / Passifs exigibles" },
      { name: "Coefficient de rentabilité", norme: "≥ 2%", description: "Résultat net / Total bilan" },
      { name: "Ratio d'endettement", norme: "≤ 9", description: "Total dettes / Fonds propres" }
    ],
    source: "Instruction n°008-05-2010 relative aux normes de gestion applicables aux institutions de microfinance"
  },
  {
    category: "Établissements Bancaires",
    ratios: [
      { name: "Ratio de solvabilité (Bâle)", norme: "≥ 10%", description: "Fonds propres / Actifs pondérés" },
      { name: "Ratio de liquidité", norme: "≥ 75%", description: "Actifs liquides / Passifs exigibles" },
      { name: "Coefficient de division des risques", norme: "≤ 45%", description: "Plus gros risque / Fonds propres" },
      { name: "Coefficient de couverture", norme: "≥ 60%", description: "Fonds propres permanents / Immobilisations" }
    ],
    source: "Dispositif prudentiel applicable aux banques et établissements financiers de l'UMOA"
  }
];

// PDF Preview Component — PDFs servis en local (public/docs/)
const PDFPreview: React.FC<{ pdfUrl: string; isOpen: boolean; sector: string; officialLink?: string }> = ({ pdfUrl, isOpen, sector, officialLink }) => {
  const [loadError, setLoadError] = useState(false);

  if (!isOpen) return null;

  return (
    <Box sx={{ mt: 2, mb: 2, mx: 2, border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ p: 1.5, bgcolor: 'grey.100', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PdfIcon color="primary" fontSize="small" />
          Prévisualisation PDF — {sector}
        </Typography>
        <Button size="small" variant="outlined" href={pdfUrl} target="_blank" rel="noopener noreferrer" startIcon={<PdfIcon />} sx={{ fontSize: '0.72rem' }}>
          Télécharger
        </Button>
      </Box>
      <Box sx={{ height: '520px', bgcolor: '#f5f5f5' }}>
        {loadError ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2, p: 3 }}>
            <PdfIcon sx={{ fontSize: 52, color: 'grey.400' }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Impossible de charger la prévisualisation.<br />
              Utilisez le bouton <strong>"Télécharger"</strong> ci-dessus.
            </Typography>
            {officialLink && (
              <Button variant="outlined" size="small" href={officialLink} target="_blank" rel="noopener noreferrer">
                Source officielle
              </Button>
            )}
          </Box>
        ) : (
          <embed
            src={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
            type="application/pdf"
            width="100%"
            height="100%"
            style={{ border: 'none', display: 'block' }}
            onError={() => setLoadError(true)}
          />
        )}
      </Box>
    </Box>
  );
};

export const DocumentationPage: React.FC<DocumentationPageProps> = ({ onNavigate }) => {
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});

  const toggleSectorExpansion = useCallback((sector: string) => {
    setExpandedSectors(prev => ({
      ...prev,
      [sector]: !prev[sector]
    }));
  }, []);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
          <DocumentIcon sx={{ mr: 2, color: 'primary.main' }} />
          Documentation Technique OptimusCredit
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Guide complet des ratios financiers, normes BCEAO et références sectorielles
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Nouveautés de la version */}
        <Grid item xs={12}>
          <Card sx={{ borderLeft: '4px solid #16a34a' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <NewReleasesIcon sx={{ mr: 1, color: '#16a34a' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Nouveautés — Release v1.0 (mai 2026)
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Les principales améliorations apportées à OptimusCredit pour faciliter
                votre travail quotidien.
              </Typography>

              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InsightsIcon sx={{ color: '#1976d2', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Analyse financière du dossier — refonte du Tab Financier
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Vue d'analyse plus spacieuse"
                        secondary="Davantage d'espace pour consulter les tableaux financiers pluriannuels et la variation entre exercices."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Évolution annuelle sur le Bilan et le Compte de Résultat"
                        secondary="Comparaison directe d'une année à l'autre, signalée en vert (progression) ou en rouge (régression)."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Consultation du fichier financier d'origine"
                        secondary="Accès en un clic au document Excel transmis par le client, pour recouper rapidement les chiffres affichés."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Définitions et normes sur les ratios clés"
                        secondary="Liquidité Générale, Marge Nette, Dette / Capitaux propres, Rotation de l'Actif : chaque ratio s'accompagne d'une explication métier et de sa norme de référence."
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ThumbsUpDownIcon sx={{ color: '#7b1fa2', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Système d'avis sur les commentaires d'analyse
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    Chaque intervenant peut désormais accompagner son commentaire d'un avis
                    explicite favorable ou défavorable, restitué dans la synthèse globale du dossier.
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Avis sur le dossier"
                        secondary="Choix Favorable / Défavorable directement dans le formulaire de commentaire, ajustable à tout moment."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Visibilité de l'avis sur chaque commentaire"
                        secondary="L'avis exprimé apparaît clairement à côté du nom de l'intervenant, pour une lecture rapide du dossier."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Synthèse globale des avis"
                        secondary="Vue d'ensemble en tête du panneau Commentaires : nombre d'avis favorables / défavorables et tendance générale du dossier."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Protection contre la perte d'un commentaire en cours"
                        secondary="La validation de l'analyse n'est possible qu'après enregistrement du commentaire saisi, pour ne perdre aucune note."
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SecurityIcon sx={{ color: '#dc2626', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Module Sécurité (IP, plages horaires, brute-force)
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Contrôle des accès par adresse"
                        secondary="Restriction des connexions aux adresses autorisées par votre établissement, pour limiter l'usage de la plateforme aux postes habilités."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Plages horaires d'accès"
                        secondary="Définition de fenêtres d'utilisation autorisées par rôle, agence ou utilisateur, avec possibilité d'autoriser un accès en consultation seule en dehors de ces plages."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Protection contre les tentatives de connexion frauduleuses"
                        secondary="Verrouillage automatique du compte concerné en cas de tentatives répétées erronées, avec notification immédiate par e-mail à l'utilisateur."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Historique des blocages et exports"
                        secondary="Tableau de bord dédié au suivi des incidents de sécurité, avec export pour l'audit interne."
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BuildIcon sx={{ color: '#f57c00', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Circuit d'approbation et dispatching — fluidité accrue
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Affichage fiable des dossiers à traiter"
                        secondary="Les approbations en attente apparaissent désormais systématiquement dans la file de l'intervenant concerné, quelle que soit la politique de crédit appliquée."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Retours en arrière maîtrisés"
                        secondary="Lorsqu'une demande de complément d'information est émise, le dossier revient correctement au chargé d'affaires pour reprise, avant d'être réinjecté dans le circuit."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Création de dossier alignée sur la politique de crédit"
                        secondary="Le rôle autorisé à créer une demande s'adapte automatiquement à la politique active de votre établissement, sans intervention technique."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Sélection des rôles facilitée pour les plages horaires"
                        secondary="Les rôles disponibles sont proposés dans une liste déroulante, évitant les erreurs de saisie lors du paramétrage."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon sx={{ color: '#16a34a' }} /></ListItemIcon>
                      <ListItemText
                        primary="Lecture des tableaux CODIR optimisée"
                        secondary="Les colonnes d'action restent visibles même sur les tableaux larges, pour une validation rapide des dossiers en comité."
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>

            </CardContent>
          </Card>
        </Grid>

        {/* Credit Process Workflow */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <BankIcon sx={{ mr: 1, color: 'primary.main' }} />
                Processus de Crédit OptimusCredit
              </Typography>

              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Vue d'Ensemble du Processus
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    OptimusCredit offre un workflow complet et configurable pour la gestion des demandes de crédit, depuis la création du client jusqu'à l'approbation finale par le comité de crédit.
                  </Typography>

                  <Box sx={{ bgcolor: '#e3f2fd', p: 3, borderRadius: 2, mb: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: '#1976d2', fontWeight: 600 }}>
                      Étapes du Processus
                    </Typography>
                    <List>
                      <ListItem>
                        <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
                        <ListItemText
                          primary="1. Gestion des Clients"
                          secondary="Création et gestion complète des clients corporatifs avec validation RCCM/TIN et traçabilité des actionnaires"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
                        <ListItemText
                          primary="2. Score Crédit"
                          secondary="Système de notation dual combinant analyse financière automatisée (ratios SYSCOHADA) et appréciation qualitative des analystes"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
                        <ListItemText
                          primary="3. Demande de Crédit"
                          secondary="Saisie complète des données financières SYSCOHADA sur 5 années avec génération automatique des ratios et benchmarking sectoriel"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
                        <ListItemText
                          primary="4. Workflow d'Approbation"
                          secondary="Routage automatique selon les seuils configurables : Directeur d'Agence (< 5M XOF) → Comité de Crédit (≥ 5M XOF) → Direction Générale (montants élevés)"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
                        <ListItemText
                          primary="5. Tableau de Bord Analytique"
                          secondary="Monitoring en temps réel avec visualisation des workflows, KPIs par département/agence et rapports d'activité"
                        />
                      </ListItem>
                    </List>
                  </Box>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Rôles et Permissions
                    </Typography>
                    <Typography variant="body2">
                      Le système supporte 6 rôles utilisateurs avec permissions granulaires :
                      <ul style={{ margin: '8px 0' }}>
                        <li><strong>Administrateur</strong> : Accès complet et gestion des utilisateurs</li>
                        <li><strong>Direction Générale</strong> : Vue analytics et rapports de performance</li>
                        <li><strong>Directeur d'Agence</strong> : Approbation jusqu'à 5M XOF et gestion d'agence</li>
                        <li><strong>Chargé d'Affaires</strong> : Création clients et demandes de crédit</li>
                        <li><strong>Analyste Crédit</strong> : Analyse technique et notation</li>
                        <li><strong>Comité de Crédit</strong> : Approbation montants ≥ 5M XOF</li>
                      </ul>
                    </Typography>
                  </Alert>

                  <Box sx={{ bgcolor: '#f1f8e9', p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: '#558b2f', fontWeight: 600 }}>
                      Fonctionnalités Clés
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>• Conformité SYSCOHADA :</strong> Traitement complet des états financiers selon normes OHADA
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>• Score Dual :</strong> Combinaison score financier automatique + appréciation analyste
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>• Benchmarking Sectoriel :</strong> Comparaison avec standards de l'industrie
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>• Interface Bilingue :</strong> Support complet Français/Anglais
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>• Gestion Documentaire :</strong> OCR, versioning et catégorisation avec audit trail
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>• Suivi Temps Réel :</strong> Monitoring processus avec notifications automatiques
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Démarrage Rapide
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    Pour commencer à utiliser OptimusCredit pour une demande de crédit :
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText
                        primary="Étape 1 : Créer le Client"
                        secondary="Menu 'Gestion Clients' → Ajouter les informations corporatives (RCCM, TIN) et actionnaires"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText
                        primary="Étape 2 : Calculer le Score"
                        secondary="Menu 'Score Crédit' → Importer états financiers SYSCOHADA ou saisie manuelle → Obtenir score automatique"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText
                        primary="Étape 3 : Créer la Demande"
                        secondary="Menu 'Demande de Crédit' → Renseigner montant, durée, garanties → Joindre documents"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText
                        primary="Étape 4 : Suivi Workflow"
                        secondary="Menu 'Workflow d'Approbation' → Visualiser progression et approbations en temps réel"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Grid>

        {/* User Guide */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <DocumentIcon sx={{ mr: 1, color: 'primary.main' }} />
                Guide d'Utilisation Technique
              </Typography>
              
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    1. Import du Template Excel OHADA/BCEAO
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    OptimusCredit utilise le format standardisé OHADA avec 3 feuilles principales :
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText primary="Bilan : Actifs et Passifs (Colonne E = Année N, Colonne F = Année N-1)" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText primary="CR : Compte de Résultat (Produits et Charges)" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText primary="TFT : Tableau des Flux de Trésorerie" />
                    </ListItem>
                  </List>
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Téléchargez le template standard depuis l'interface et remplissez les colonnes E (année N) et F (année N-1) avec vos données financières.
                  </Alert>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    2. Configuration et Analyse
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText primary="Sélectionnez l'année de référence et le nombre d'années à analyser" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText primary="Choisissez le secteur d'activité pour les références sectorielles" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText primary="Importez le fichier Excel ou utilisez la saisie manuelle" />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
                      <ListItemText primary="Consultez l'analyse complète avec ratios, tendances et conformité BCEAO" />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    3. Guide Utilisateur Complet OptimusCredit
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" paragraph>
                    Un guide utilisateur détaillé et complet est disponible pour accompagner votre utilisation d'OptimusCredit :
                  </Typography>
                  
                  {/* Guide Preview Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, p: 2, bgcolor: 'primary.main', color: 'white', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PdfIcon sx={{ mr: 1, fontSize: '1.5rem' }} />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Guide Utilisateur OptimusCredit
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>
                          Version 2.0 - Août 2025 | Système d'Analyse Financière Avancée
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Box
                        component="button"
                        onClick={() => {
                          // Create a new window with the guide content
                          const guideWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
                          if (guideWindow) {
                            guideWindow.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guide Utilisateur - OptimusCredit Analyse Financière</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            background: linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%);
            color: white;
            padding: 30px;
            margin: -40px -40px 40px -40px;
            border-radius: 8px 8px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 600;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 1.2em;
            opacity: 0.9;
        }
        h2 {
            color: #1f4e79;
            border-bottom: 3px solid #2c5aa0;
            padding-bottom: 10px;
            margin-top: 40px;
        }
        h3 {
            color: #2c5aa0;
            margin-top: 30px;
        }
        .feature-box {
            background: #f8f9fa;
            border-left: 4px solid #2c5aa0;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .step-box {
            background: #e3f2fd;
            border: 1px solid #2196f3;
            padding: 15px;
            margin: 15px 0;
            border-radius: 6px;
        }
        .warning-box {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
            border-radius: 6px;
        }
        .formula-box {
            background: #f1f8e9;
            border: 1px solid #8bc34a;
            padding: 15px;
            margin: 15px 0;
            border-radius: 6px;
            font-family: monospace;
            text-align: center;
            font-size: 1.1em;
            font-weight: bold;
        }
        ul, ol {
            padding-left: 30px;
        }
        li {
            margin-bottom: 8px;
        }
        .table-of-contents {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
        }
        .table-of-contents h3 {
            margin-top: 0;
            color: #1f4e79;
        }
        .table-of-contents ul {
            list-style: none;
            padding-left: 0;
        }
        .table-of-contents li {
            margin-bottom: 5px;
        }
        .table-of-contents a {
            text-decoration: none;
            color: #2c5aa0;
        }
        .table-of-contents a:hover {
            text-decoration: underline;
        }
        .version-info {
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .page-break {
            page-break-before: always;
        }
        
        /* Print-specific styles for A4 optimization */
        @media print {
            @page {
                margin: 20mm 15mm 15mm 15mm;
                @top-center {
                    content: "Guide d'utilisateur OptimusCredit - Système d'analyse financière avancée";
                    font-size: 10pt;
                    font-weight: bold;
                    color: #1f4e79;
                    border-bottom: 1pt solid #2c5aa0;
                    padding-bottom: 2mm;
                    margin-bottom: 5mm;
                }
                @bottom-center {
                    content: "Page " counter(page) " sur " counter(pages);
                    font-size: 9pt;
                    color: #666;
                }
            }
            
            body {
                margin: 0;
                padding: 0;
                font-size: 11pt;
                line-height: 1.4;
                color: black;
                background: white;
                counter-reset: page;
            }
            
            .container {
                max-width: none;
                margin: 0;
                padding: 5mm 0;
                box-shadow: none;
                border-radius: 0;
            }
            
            .header {
                margin: -5mm 0 15mm 0;
                padding: 10mm 15mm;
                background: #1f4e79 !important;
                color: white !important;
                border-radius: 0;
                page-break-after: avoid;
            }
            
            .header h1 {
                font-size: 22pt;
                margin-bottom: 5mm;
            }
            
            .header p {
                font-size: 14pt;
                margin: 0;
            }
            
            .table-of-contents {
                page-break-after: always;
                margin-bottom: 0;
            }
            
            h2 {
                page-break-before: always;
                margin-top: 0;
                padding-top: 10mm;
                font-size: 16pt;
                border-bottom: 2pt solid #2c5aa0;
            }
            
            h2:first-of-type {
                page-break-before: avoid;
            }
            
            h3 {
                page-break-after: avoid;
                margin-top: 8mm;
                margin-bottom: 4mm;
                font-size: 13pt;
            }
            
            h4 {
                page-break-after: avoid;
                margin-top: 6mm;
                margin-bottom: 3mm;
                font-size: 12pt;
            }
            
            .feature-box, .step-box, .warning-box {
                page-break-inside: avoid;
                margin: 4mm 0;
                padding: 4mm;
                border: 1pt solid #ccc;
            }
            
            .formula-box {
                page-break-inside: avoid;
                margin: 3mm 0;
                padding: 4mm;
                border: 1pt solid #8bc34a;
                text-align: center;
                font-weight: bold;
                font-size: 12pt;
            }
            
            ul, ol {
                page-break-inside: avoid;
                margin: 2mm 0;
                padding-left: 6mm;
            }
            
            li {
                margin-bottom: 1mm;
                page-break-inside: avoid;
            }
            
            p {
                margin: 2mm 0;
                orphans: 3;
                widows: 3;
            }
            
            .version-info {
                page-break-before: always;
                text-align: center;
                margin-top: 20mm;
                padding-top: 10mm;
                border-top: 1pt solid #ccc;
                font-size: 10pt;
            }
            
            /* Avoid breaks after headings */
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
                orphans: 3;
                widows: 3;
            }
            
            /* Keep related content together */
            .step-box ol, .feature-box ul {
                page-break-inside: avoid;
            }
            
            /* Hide scripts and non-essential elements */
            script {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Guide Utilisateur OptimusCredit</h1>
            <p>Système d'Analyse Financière Avancée</p>
        </div>

        <div class="table-of-contents">
            <h3>📋 Table des Matières</h3>
            <ul>
                <li><a href="#introduction">1. Introduction</a></li>
                <li><a href="#saisie-donnees">2. Saisie des Données</a></li>
                <li><a href="#analyse-detaillee">3. Analyse Financière Détaillée</a></li>
                <li><a href="#conformite-bceao">4. Conformité BCEAO</a></li>
                <li><a href="#generation-rapports">5. Génération de Rapports</a></li>
                <li><a href="#formules-ratios">6. Formules des Ratios Financiers</a></li>
                <li><a href="#troubleshooting">7. Résolution de Problèmes</a></li>
            </ul>
        </div>

        <section id="introduction">
            <h2>🎯 1. Introduction</h2>
            <p><strong>OptimusCredit</strong> est un système d'analyse financière avancée conçu spécifiquement pour les analystes financiers travaillant dans l'environnement réglementaire de la BCEAO (Banque Centrale des États de l'Afrique de l'Ouest).</p>
            
            <div class="feature-box">
                <h4>✨ Fonctionnalités Principales</h4>
                <ul>
                    <li><strong>Analyse Multi-Années</strong> : Analyse comparative sur plusieurs exercices</li>
                    <li><strong>Conformité BCEAO</strong> : Vérification automatique des normes réglementaires</li>
                    <li><strong>Recommandations Sectorielles</strong> : Conseils adaptés au secteur d'activité</li>
                    <li><strong>Génération de Rapports PDF</strong> : Documents professionnels automatisés</li>
                    <li><strong>Tableau de Bord Interactif</strong> : Visualisations graphiques avancées</li>
                </ul>
            </div>
        </section>

        <section id="saisie-donnees">
            <h2>📊 2. Saisie des Données Financières</h2>
            
            <h3>2.1 Configuration Initiale</h3>
            <div class="step-box">
                <p>Avant de commencer l'analyse, vous devez configurer les informations de base :</p>
                <ol>
                    <li>Accédez au système OptimusCredit</li>
                    <li>Dans la section "Saisie des Données", renseignez :
                        <ul>
                            <li><strong>Nom de l'entreprise</strong></li>
                            <li><strong>Secteur d'activité</strong> (Industrie, Commerce, Services, Agriculture)</li>
                            <li><strong>Année de référence</strong></li>
                            <li><strong>Période d'analyse</strong> (nombre d'années)</li>
                        </ul>
                    </li>
                </ol>
            </div>
            
            <h3>2.2 Import par Fichier Excel</h3>
            <div class="step-box">
                <ol>
                    <li>Préparez vos fichiers Excel avec les états financiers</li>
                    <li>Accédez à <strong>"Saisie des Données"</strong></li>
                    <li>Cliquez sur <strong>"Importer Excel"</strong></li>
                    <li>Sélectionnez vos fichiers (un par année)</li>
                    <li>Vérifiez la correspondance des colonnes</li>
                    <li>Validez l'import</li>
                </ol>
            </div>

            <div class="warning-box">
                <strong>⚠️ Points d'Attention</strong><br>
                • Vérifiez la cohérence des montants<br>
                • Respectez les formats numériques<br>
                • Assurez-vous de la complétude des données
            </div>
        </section>

        <section id="analyse-detaillee">
            <h2>🔍 3. Analyse Financière Détaillée</h2>
            
            <p>L'analyse détaillée se compose de 5 onglets principaux avec progression multi-années et recommandations sectorielles.</p>

            <div class="feature-box">
                <h4>📈 États Financiers</h4>
                <p>Affiche les données financières avec variation annuelle sous chaque valeur et tendances d'amélioration/dégradation.</p>
                
                <h4>💰 Ratios Détaillés</h4>
                <p>Calculs automatiques des ratios financiers avec progression sur plusieurs années.</p>
                
                <h4>🏛️ Conformité BCEAO</h4>
                <p>Vérification réglementaire complète avec historique multi-années, recommandations personnalisées et formules détaillées.</p>
            </div>
        </section>

        <section id="conformite-bceao">
            <h2>🏛️ 4. Module Conformité BCEAO</h2>
            
            <h3>4.1 Fonctionnalités Avancées</h3>
            <div class="feature-box">
                <ul>
                    <li><strong>Analyse Multi-Années</strong> : Évolution des ratios sur toute la période d'analyse</li>
                    <li><strong>Recommandations Sectorielles</strong> : Conseils adaptés au secteur d'activité</li>
                    <li><strong>Formules des Ratios</strong> : Affichage détaillé des formules de calcul</li>
                    <li><strong>Statuts en Français</strong> : Excellent, Bon, Acceptable, Insuffisant, Critique</li>
                    <li><strong>Tendances Visuelles</strong> : Icônes d'amélioration, dégradation ou stabilité</li>
                </ul>
            </div>
        </section>

        <section id="generation-rapports">
            <h2>📄 5. Génération de Rapports</h2>
            
            <h3>5.1 Types de Rapports</h3>
            <div class="feature-box">
                <ul>
                    <li><strong>Rapport Complet</strong> : Analyse exhaustive avec tous les détails</li>
                    <li><strong>Rapport Exécutif</strong> : Synthèse managériale</li>
                    <li><strong>Rapport Conformité BCEAO</strong> : Focus réglementaire</li>
                </ul>
            </div>
        </section>

        <section id="formules-ratios">
            <h2>🧮 6. Formules des Ratios Financiers</h2>
            
            <h3>6.1 Ratios de Liquidité</h3>
            
            <h4>Ratio de Liquidité Générale</h4>
            <div class="formula-box">
                Actif Circulant / Passif Circulant
            </div>
            <p><em>Norme BCEAO : ≥ 1,2</em></p>

            <h4>Ratio de Liquidité Immédiate</h4>
            <div class="formula-box">
                Disponibilités / Passif Circulant
            </div>
            <p><em>Norme BCEAO : ≥ 0,3</em></p>

            <h3>6.2 Ratios de Solvabilité</h3>
            
            <h4>Ratio d'Autonomie Financière</h4>
            <div class="formula-box">
                (Capitaux Propres / Total Bilan) × 100
            </div>
            <p><em>Norme BCEAO : ≥ 20%</em></p>

            <h3>6.3 Ratios de Rentabilité</h3>
            
            <h4>ROE - Rentabilité des Capitaux Propres</h4>
            <div class="formula-box">
                (Résultat Net / Capitaux Propres) × 100
            </div>
            <p><em>Norme BCEAO : ≥ 10%</em></p>

            <h4>ROA - Rentabilité de l'Actif</h4>
            <div class="formula-box">
                (Résultat Net / Total Actif) × 100
            </div>
            <p><em>Norme BCEAO : ≥ 5%</em></p>
        </section>

        <section id="troubleshooting">
            <h2>🔧 7. Résolution de Problèmes</h2>
            
            <div class="warning-box">
                <h4>❌ Problèmes Courants</h4>
                <p><strong>Erreur d'Import Excel :</strong> Vérifiez le format .xlsx et les en-têtes de colonnes</p>
                <p><strong>Données Manquantes :</strong> Contrôlez la cohérence des montants</p>
                <p><strong>Analyse Incomplète :</strong> Assurez-vous que tous les champs obligatoires sont renseignés</p>
            </div>

            <div class="feature-box">
                <h4>✅ Bonnes Pratiques</h4>
                <ul>
                    <li><strong>Validation :</strong> Vérifiez la cohérence des données saisies</li>
                    <li><strong>Sauvegarde :</strong> Exportez régulièrement vos analyses</li>
                    <li><strong>Documentation :</strong> Conservez les sources de vos données</li>
                </ul>
            </div>
        </section>

        <div class="version-info">
            <p><strong>Guide Utilisateur OptimusCredit - Version 2.0</strong></p>
            <p>Dernière mise à jour : Août 2025</p>
            <p>© 2025 OptimusCredit - Outil d'analyse financière</p>
        </div>
    </div>

    <script>
        // Print functionality
        window.addEventListener('load', function() {
            const printButton = document.createElement('button');
            printButton.textContent = '🖨️ Imprimer / Générer PDF';
            printButton.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                padding: 10px 20px;
                background: #2c5aa0;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            \`;
            printButton.addEventListener('click', function() {
                window.print();
            });
            
            document.body.appendChild(printButton);
        });
        
        // Optimize for print when printing
        window.addEventListener('beforeprint', function() {
            document.title = 'Guide_Utilisateur_OptimusCredit_2025';
        });
    </script>
</body>
</html>
                            `);
                            guideWindow.document.close();
                          }
                        }}
                        sx={{ 
                          background: 'rgba(255,255,255,0.2)',
                          border: 'none',
                          color: 'white',
                          borderRadius: 1,
                          px: 2,
                          py: 1,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.3)'
                          }
                        }}
                      >
                        <PdfIcon sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                        Ouvrir en Plein Écran
                      </Box>
                      
                      <Box
                        component="button"
                        onClick={() => {
                          const iframe = document.getElementById('user-guide-iframe') as HTMLIFrameElement;
                          if (iframe?.contentWindow) {
                            iframe.contentWindow.print();
                          }
                        }}
                        sx={{ 
                          background: 'rgba(255,255,255,0.2)',
                          border: 'none',
                          color: 'white',
                          borderRadius: 1,
                          px: 2,
                          py: 1,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.3)'
                          }
                        }}
                      >
                        🖨️ Imprimer
                      </Box>
                    </Box>
                  </Box>

                  {/* Embedded Guide Preview - Real Content */}
                  <Box sx={{ 
                    border: '1px solid #e0e0e0', 
                    borderRadius: 1, 
                    overflow: 'auto',
                    bgcolor: '#f8f9fa',
                    mb: 2,
                    height: '600px',
                    p: 3
                  }}>
                    {/* Actual Guide Content Preview - Matching the real guide */}
                    <Box sx={{ 
                      maxWidth: '800px', 
                      margin: '0 auto',
                      background: 'white',
                      padding: '40px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                    }}>
                      <Box sx={{ 
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, #1f4e79 0%, #2c5aa0 100%)',
                        color: 'white',
                        padding: '30px',
                        margin: '-40px -40px 40px -40px',
                        borderRadius: '8px 8px 0 0'
                      }}>
                        <Typography variant="h3" sx={{ margin: 0, fontWeight: 600, color: 'white' }}>
                          📊 Guide Utilisateur OptimusCredit
                        </Typography>
                        <Typography variant="h6" sx={{ margin: '10px 0 0 0', opacity: 0.9, color: 'white' }}>
                          Système d'Analyse Financière Avancée
                        </Typography>
                      </Box>

                      <Box sx={{ 
                        bgcolor: '#f8f9fa', 
                        p: 2, 
                        borderRadius: '6px', 
                        mb: 3
                      }}>
                        <Typography variant="h6" sx={{ color: '#1f4e79', mb: 2, mt: 0 }}>
                          📋 Table des Matières
                        </Typography>
                        <List sx={{ listStyle: 'none', p: 0 }}>
                          <ListItem sx={{ mb: '5px', p: 0 }}>
                            <Link href="#introduction" sx={{ textDecoration: 'none', color: '#2c5aa0' }}>
                              1. Introduction
                            </Link>
                          </ListItem>
                          <ListItem sx={{ mb: '5px', p: 0 }}>
                            <Link href="#saisie-donnees" sx={{ textDecoration: 'none', color: '#2c5aa0' }}>
                              2. Saisie des Données
                            </Link>
                          </ListItem>
                          <ListItem sx={{ mb: '5px', p: 0 }}>
                            <Link href="#analyse-detaillee" sx={{ textDecoration: 'none', color: '#2c5aa0' }}>
                              3. Analyse Financière Détaillée
                            </Link>
                          </ListItem>
                          <ListItem sx={{ mb: '5px', p: 0 }}>
                            <Link href="#conformite-bceao" sx={{ textDecoration: 'none', color: '#2c5aa0' }}>
                              4. Conformité BCEAO
                            </Link>
                          </ListItem>
                          <ListItem sx={{ mb: '5px', p: 0 }}>
                            <Link href="#generation-rapports" sx={{ textDecoration: 'none', color: '#2c5aa0' }}>
                              5. Génération de Rapports
                            </Link>
                          </ListItem>
                          <ListItem sx={{ mb: '5px', p: 0 }}>
                            <Link href="#formules-ratios" sx={{ textDecoration: 'none', color: '#2c5aa0' }}>
                              6. Formules des Ratios Financiers
                            </Link>
                          </ListItem>
                          <ListItem sx={{ mb: '5px', p: 0 }}>
                            <Link href="#troubleshooting" sx={{ textDecoration: 'none', color: '#2c5aa0' }}>
                              7. Résolution de Problèmes
                            </Link>
                          </ListItem>
                        </List>
                      </Box>

                      {/* Section 1: Introduction */}
                      <Box component="section" id="introduction" sx={{ mb: 4 }}>
                        <Typography variant="h5" sx={{ 
                          color: '#1f4e79',
                          borderBottom: '3px solid #2c5aa0',
                          paddingBottom: '10px',
                          marginTop: '40px',
                          mb: 2
                        }}>
                          🎯 1. Introduction
                        </Typography>
                        <Typography variant="body1" paragraph>
                          <strong>OptimusCredit</strong> est un système d'analyse financière avancée conçu spécifiquement pour les analystes financiers travaillant dans l'environnement réglementaire de la BCEAO (Banque Centrale des États de l'Afrique de l'Ouest).
                        </Typography>
                        
                        <Box sx={{ 
                          background: '#f8f9fa',
                          borderLeft: '4px solid #2c5aa0',
                          padding: '20px',
                          margin: '20px 0',
                          borderRadius: '4px'
                        }}>
                          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            ✨ Fonctionnalités Principales
                          </Typography>
                          <List>
                            <ListItem sx={{ py: 0.5, pl: 0 }}>
                              <ListItemText primary={<><strong>Analyse Multi-Années</strong> : Analyse comparative sur plusieurs exercices</>} />
                            </ListItem>
                            <ListItem sx={{ py: 0.5, pl: 0 }}>
                              <ListItemText primary={<><strong>Conformité BCEAO</strong> : Vérification automatique des normes réglementaires</>} />
                            </ListItem>
                            <ListItem sx={{ py: 0.5, pl: 0 }}>
                              <ListItemText primary={<><strong>Recommandations Sectorielles</strong> : Conseils adaptés au secteur d'activité</>} />
                            </ListItem>
                            <ListItem sx={{ py: 0.5, pl: 0 }}>
                              <ListItemText primary={<><strong>Génération de Rapports PDF</strong> : Documents professionnels automatisés</>} />
                            </ListItem>
                            <ListItem sx={{ py: 0.5, pl: 0 }}>
                              <ListItemText primary={<><strong>Tableau de Bord Interactif</strong> : Visualisations graphiques avancées</>} />
                            </ListItem>
                          </List>
                        </Box>
                      </Box>

                      {/* Section 2: Saisie des Données */}
                      <Box component="section" id="saisie-donnees" sx={{ mb: 4 }}>
                        <Typography variant="h5" sx={{ 
                          color: '#1f4e79',
                          borderBottom: '3px solid #2c5aa0',
                          paddingBottom: '10px',
                          marginTop: '40px',
                          mb: 2
                        }}>
                          📊 2. Saisie des Données Financières
                        </Typography>

                        <Typography variant="h6" sx={{ color: '#2c5aa0', mt: 3, mb: 2 }}>
                          2.1 Configuration Initiale
                        </Typography>
                        <Box sx={{ 
                          background: '#e3f2fd',
                          border: '1px solid #2196f3',
                          padding: '15px',
                          margin: '15px 0',
                          borderRadius: '6px'
                        }}>
                          <Typography variant="body2" paragraph>
                            Avant de commencer l'analyse, vous devez configurer les informations de base :
                          </Typography>
                          <ol style={{ paddingLeft: '30px' }}>
                            <li style={{ marginBottom: '8px' }}>
                              Accédez au système OptimusCredit
                            </li>
                            <li style={{ marginBottom: '8px' }}>
                              Dans la section "Saisie des Données", renseignez :
                              <ul style={{ paddingLeft: '30px' }}>
                                <li><strong>Nom de l'entreprise</strong></li>
                                <li><strong>Secteur d'activité</strong> (Industrie, Commerce, Services, Agriculture)</li>
                                <li><strong>Année de référence</strong></li>
                                <li><strong>Période d'analyse</strong> (nombre d'années)</li>
                              </ul>
                            </li>
                          </ol>
                          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                            Le secteur choisi influence les normes BCEAO et les recommandations générées.
                          </Typography>
                        </Box>
                      </Box>

                      {/* Continue indicator */}
                      <Alert severity="info" sx={{ mt: 4 }}>
                        <Typography variant="body2">
                          <strong>Prévisualisation des premières sections...</strong> Le guide complet contient 7 sections détaillées avec toutes les formules, exemples pratiques et instructions complètes. Cliquez sur "Ouvrir en Plein Écran" pour accéder au contenu intégral optimisé pour l'impression.
                        </Typography>
                      </Alert>

                      <Box sx={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', mt: 4, pt: 2, borderTop: '1px solid #eee' }}>
                        <Typography variant="body2" fontWeight={600}>
                          Guide Utilisateur OptimusCredit - Version 2.0
                        </Typography>
                        <Typography variant="caption">
                          Dernière mise à jour : Août 2025 | © 2025 OptimusCredit - Outil d'analyse financière
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>💡 Guide complet intégré :</strong> Le guide utilisateur complet est affiché ci-dessus avec 
                      tous les détails sur l'utilisation d'OptimusCredit. Utilisez "Ouvrir en Plein Écran" pour une vue complète 
                      ou "Imprimer" pour générer un PDF optimisé A4.
                    </Typography>
                  </Alert>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Grid>

        {/* Liquidity Ratios */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <CalculateIcon sx={{ mr: 1, color: 'primary.main' }} />
                Ratios de Liquidité
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Ratio</strong></TableCell>
                      <TableCell><strong>Formule</strong></TableCell>
                      <TableCell><strong>Interprétation</strong></TableCell>
                      <TableCell><strong>Excellent</strong></TableCell>
                      <TableCell><strong>Bon</strong></TableCell>
                      <TableCell><strong>Acceptable</strong></TableCell>
                      <TableCell><strong>Critique</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {liquidityRatios.map((ratio, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ fontWeight: 600 }}>{ratio.name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{ratio.formula}</TableCell>
                        <TableCell sx={{ fontSize: '0.875rem' }}>{ratio.interpretation}</TableCell>
                        <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>{ratio.excellent}</TableCell>
                        <TableCell sx={{ color: 'info.main', fontWeight: 600 }}>{ratio.good}</TableCell>
                        <TableCell sx={{ color: 'warning.main', fontWeight: 600 }}>{ratio.acceptable}</TableCell>
                        <TableCell sx={{ color: 'error.main', fontWeight: 600 }}>{ratio.critical}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Solvability Ratios */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <BankIcon sx={{ mr: 1, color: 'primary.main' }} />
                Ratios de Solvabilité
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Ratio</strong></TableCell>
                      <TableCell><strong>Formule</strong></TableCell>
                      <TableCell><strong>Interprétation</strong></TableCell>
                      <TableCell><strong>Excellent</strong></TableCell>
                      <TableCell><strong>Bon</strong></TableCell>
                      <TableCell><strong>Acceptable</strong></TableCell>
                      <TableCell><strong>Critique</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {solvabilityRatios.map((ratio, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ fontWeight: 600 }}>{ratio.name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{ratio.formula}</TableCell>
                        <TableCell sx={{ fontSize: '0.875rem' }}>{ratio.interpretation}</TableCell>
                        <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>{ratio.excellent}</TableCell>
                        <TableCell sx={{ color: 'info.main', fontWeight: 600 }}>{ratio.good}</TableCell>
                        <TableCell sx={{ color: 'warning.main', fontWeight: 600 }}>{ratio.acceptable}</TableCell>
                        <TableCell sx={{ color: 'error.main', fontWeight: 600 }}>{ratio.critical}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Profitability Ratios */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <TrendingUpIcon sx={{ mr: 1, color: 'primary.main' }} />
                Ratios de Rentabilité
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Ratio</strong></TableCell>
                      <TableCell><strong>Formule</strong></TableCell>
                      <TableCell><strong>Interprétation</strong></TableCell>
                      <TableCell><strong>Excellent</strong></TableCell>
                      <TableCell><strong>Bon</strong></TableCell>
                      <TableCell><strong>Acceptable</strong></TableCell>
                      <TableCell><strong>Critique</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {profitabilityRatios.map((ratio, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ fontWeight: 600 }}>{ratio.name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{ratio.formula}</TableCell>
                        <TableCell sx={{ fontSize: '0.875rem' }}>{ratio.interpretation}</TableCell>
                        <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>{ratio.excellent}</TableCell>
                        <TableCell sx={{ color: 'info.main', fontWeight: 600 }}>{ratio.good}</TableCell>
                        <TableCell sx={{ color: 'warning.main', fontWeight: 600 }}>{ratio.acceptable}</TableCell>
                        <TableCell sx={{ color: 'error.main', fontWeight: 600 }}>{ratio.critical}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Sectoral References */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SourceIcon sx={{ mr: 1, color: 'primary.main' }} />
                Références Sectorielles
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Secteur</strong></TableCell>
                      <TableCell><strong>Liquidité Générale</strong></TableCell>
                      <TableCell><strong>Autonomie Financière</strong></TableCell>
                      <TableCell><strong>ROE</strong></TableCell>
                      <TableCell><strong>Rotation Actif</strong></TableCell>
                      <TableCell><strong>Source</strong></TableCell>
                      <TableCell><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sectoralReferences.map((ref, index) => (
                      <React.Fragment key={index}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>{ref.sector}</TableCell>
                          <TableCell>{ref.liquidite_generale}</TableCell>
                          <TableCell>{ref.autonomie_financiere}</TableCell>
                          <TableCell>{ref.roe}</TableCell>
                          <TableCell>{ref.rotation_actif}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Link href={ref.link} target="_blank" rel="noopener noreferrer" sx={{ fontSize: '0.875rem' }}>
                                {ref.source}
                              </Link>
                              {ref.downloadLink && (
                                <Link 
                                  href={ref.downloadLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  sx={{ fontSize: '0.75rem', color: 'primary.main', textDecoration: 'underline' }}
                                >
                                  <PdfIcon sx={{ fontSize: '0.8rem', mr: 0.5 }} />
                                  Télécharger PDF
                                </Link>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {ref.downloadLink && (
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Typography
                                  component="button"
                                  variant="body2"
                                  onClick={() => toggleSectorExpansion(ref.sector)}
                                  sx={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'primary.main',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    '&:hover': { color: 'primary.dark' }
                                  }}
                                >
                                  {expandedSectors[ref.sector] ? (
                                    <>
                                      <ExpandLessIcon sx={{ fontSize: '0.9rem' }} />
                                      Masquer PDF
                                    </>
                                  ) : (
                                    <>
                                      <ExpandMoreIcon sx={{ fontSize: '0.9rem' }} />
                                      Prévisualiser PDF
                                    </>
                                  )}
                                </Typography>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedSectors[ref.sector] && ref.downloadLink && (
                          <TableRow>
                            <TableCell colSpan={7} sx={{ p: 0, border: 'none' }}>
                              <PDFPreview
                                pdfUrl={ref.downloadLink}
                                isOpen={expandedSectors[ref.sector]}
                                sector={ref.sector}
                                officialLink={ref.link}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Sources Complémentaires Recommandées
                </Typography>
                <Typography variant="body2" component="div">
                  • <Link href="https://www.bceao.int/fr/publications/rapport-annuel-de-la-bceao-2023" target="_blank" rel="noopener">
                    BCEAO - Rapport Annuel 2023
                  </Link> - Analyses macro-économiques et sectorielles<br/>
                  • <Link href="https://www.imf.org/en/Data/Statistics/FSI-guide" target="_blank" rel="noopener">
                    FMI - Guide des Indicateurs de Solidité Financière
                  </Link> - Méthodologie standardisée<br/>
                  • <Link href="https://www.enterprisesurveys.org/en/data" target="_blank" rel="noopener">
                    Banque Mondiale - Enquêtes Entreprises
                  </Link> - Données sectorielles comparatives<br/>
                  • <Link href="https://www.bceao.int/fr/publications/rapport-sur-la-politique-monetaire-de-lumoa-juin-2023" target="_blank" rel="noopener">
                    BCEAO - Politique Monétaire UMOA 2023
                  </Link> - Contexte économique régional
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Soldes Intermédiaires de Gestion */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <AnalysisIcon sx={{ mr: 1, color: 'primary.main' }} />
                Soldes Intermédiaires de Gestion (SIG)
              </Typography>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Les Soldes Intermédiaires de Gestion permettent d'analyser la formation du résultat de l'entreprise étape par étape :
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 150 }}><strong>Solde</strong></TableCell>
                      <TableCell sx={{ minWidth: 200 }}><strong>Formule de Calcul</strong></TableCell>
                      <TableCell sx={{ minWidth: 300 }}><strong>Signification Économique</strong></TableCell>
                      <TableCell sx={{ minWidth: 300 }}><strong>Exemple Concret</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {soldesIntermediaires.map((solde, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ fontWeight: 600, verticalAlign: 'top' }}>{solde.name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem', verticalAlign: 'top' }}>{solde.formula}</TableCell>
                        <TableCell sx={{ fontSize: '0.875rem', verticalAlign: 'top', lineHeight: 1.5 }}>{solde.description}</TableCell>
                        <TableCell sx={{ fontSize: '0.875rem', verticalAlign: 'top', lineHeight: 1.5, fontStyle: 'italic', bgcolor: 'grey.50' }}>
                          {solde.example}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Alert severity="success" sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Analyse en Cascade
                </Typography>
                <Typography variant="body2">
                  L'analyse des SIG permet d'identifier précisément les sources de performance ou de défaillance : 
                  commerciale (Marge), productive (Valeur Ajoutée), opérationnelle (EBE), financière (Résultat Courant).
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* BCEAO Norms */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <ComplianceIcon sx={{ mr: 1, color: 'primary.main' }} />
                Normes BCEAO pour les Institutions Financières
              </Typography>
              
              {bceaoNorms.map((norm, index) => (
                <Box key={index} sx={{ mb: 4 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {norm.category}
                  </Typography>
                  
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Ratio Prudentiel</strong></TableCell>
                          <TableCell><strong>Norme BCEAO</strong></TableCell>
                          <TableCell><strong>Mode de Calcul</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {norm.ratios.map((ratio, ratioIndex) => (
                          <TableRow key={ratioIndex}>
                            <TableCell sx={{ fontWeight: 600 }}>{ratio.name}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>{ratio.norme}</TableCell>
                            <TableCell sx={{ fontSize: '0.875rem' }}>{ratio.description}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Typography variant="caption" color="text.secondary">
                    <strong>Référence légale :</strong> {norm.source}
                  </Typography>
                </Box>
              ))}
              
              <Alert severity="warning" sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Application des Normes
                </Typography>
                <Typography variant="body2">
                  Ces normes s'appliquent spécifiquement aux institutions financières agréées par la BCEAO. 
                  Pour les entreprises commerciales et industrielles, OptimusCredit utilise les ratios d'analyse financière standards 
                  avec les seuils d'interprétation adaptés au contexte économique de l'UEMOA.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Reference */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3, color: 'white' }}>
                <CheckIcon sx={{ mr: 1, color: 'white' }} />
                Aide-Mémoire Rapide
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'white' }}>
                    Liquidité
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                    • Générale ≥ 1,2<br/>
                    • Immédiate ≥ 0,3<br/>
                    • BFR &lt; 60 jours CA
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'white' }}>
                    Solvabilité
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                    • Autonomie ≥ 20%<br/>
                    • Endettement ≤ 70%<br/>
                    • Couverture ≥ 3x
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'white' }}>
                    Rentabilité
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, color: 'white' }}>
                    • ROE ≥ 10%<br/>
                    • ROA ≥ 5%<br/>
                    • Marge Nette ≥ 3%
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DocumentationPage;