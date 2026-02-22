import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  LinearProgress,
  Chip,
  Grid,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  AccountBalance as BalanceIcon,
  Assessment as IncomeIcon,
  Timeline as CashFlowIcon,
  TrendingDown as LiabilitiesIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { ocrService } from '../services/ocrService';

interface OcrUploadProps {
  onDataExtracted: (data: any, year?: number) => void;
  onDocumentUploaded?: (document: any) => void;
  targetYear?: number;
}

interface ExtractedData {
  confidence?: number;
  data: any;
  originalText?: string;
}

export const OcrUpload: React.FC<OcrUploadProps> = ({ onDataExtracted, onDocumentUploaded, targetYear }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [showReviewMode, setShowReviewMode] = useState(false);
  const [reviewData, setReviewData] = useState<any>({});

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('📁 OCR UPLOAD: onDrop called with', acceptedFiles.length, 'files');
    const file = acceptedFiles[0];
    if (!file) {
      console.log('❌ OCR UPLOAD: No file provided');
      return;
    }

    console.log('📄 OCR UPLOAD: File details:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    if (file.type !== 'application/pdf') {
      console.log('❌ OCR UPLOAD: Invalid file type:', file.type);
      setError('Seuls les fichiers PDF sont acceptés pour l\'OCR.');
      return;
    }

    console.log('✅ OCR UPLOAD: Valid PDF file, starting processing...');
    setUploadedFile(file);
    setError(null);
    await processFile(file);

    // Notify parent component about the uploaded document
    if (onDocumentUploaded) {
      onDocumentUploaded({
        id: `doc-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        category: 'financial',
        uploadDate: new Date(),
        status: 'pending',
        file: file,
      });
    }
  }, [onDocumentUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const processFile = async (file: File) => {
    console.log('🚀 OCR UPLOAD: processFile called with:', file.name);
    setIsProcessing(true);
    setProcessingProgress(10);
    setProgressText('Initialisation de l\'OCR...');
    setError(null);

    try {
      console.log('=== OCR UPLOAD: Starting processing ===');
      console.log(`File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log('File type:', file.type);
      console.log('File last modified:', new Date(file.lastModified).toISOString());

      // Step 1: Initialize OCR
      await ocrService.initializeOcr();
      setProcessingProgress(20);
      setProgressText('Analyse du document PDF...');

      // Step 2: Extract financial data (this handles everything internally)
      const financialData = await ocrService.extractFinancialData(file, {
        language: 'fra'
      });

      setProcessingProgress(80);
      setProgressText('Conversion au format OptimusCredit...');

      // Step 3: Convert to OptimusCredit format
      const optimusData = ocrService.convertToOptimusFormat(financialData);

      setProcessingProgress(90);
      setProgressText('Extraction du texte pour prévisualisation...');

      // Step 4: Get text for preview (simplified)
      let previewText = 'Texte extrait du PDF (résumé des données financières trouvées):\n\n';
      
      if (Object.keys(optimusData).length > 0) {
        previewText += 'Données financières extraites:\n';
        Object.entries(optimusData).forEach(([key, value]) => {
          previewText += `- ${key}: ${value}\n`;
        });
      } else {
        previewText += 'Aucune donnée financière détectée dans le document.\n';
        previewText += 'Vérifiez que le document contient des états financiers SYSCOHADA.';
      }

      setExtractedText(previewText);

      setProcessingProgress(100);
      setProgressText('Traitement terminé !');

      setExtractedData({
        confidence: financialData.confidence || 0,
        data: optimusData,
        originalText: previewText
      });

      console.log('=== OCR UPLOAD: Processing completed ===');
      console.log('Extracted fields:', Object.keys(optimusData));
      console.log('Confidence:', financialData.confidence);
      console.log('Sample data:', Object.entries(optimusData).slice(0, 3));

    } catch (error) {
      console.error('=== OCR UPLOAD: Processing failed ===', error);
      setError(error instanceof Error ? error.message : 'Erreur lors du traitement OCR');
      
      // Set empty result for debugging
      setExtractedData({
        confidence: 0,
        data: {},
        originalText: `Erreur lors du traitement:\n${error instanceof Error ? error.message : 'Erreur inconnue'}`
      });
    } finally {
      setIsProcessing(false);
      await ocrService.cleanup();
    }
  };

  const handleReviewData = () => {
    if (extractedData) {
      setReviewData(extractedData.data);
      setShowReviewMode(true);
    }
  };

  const handleConfirmReviewedData = () => {
    onDataExtracted(reviewData, targetYear);
  };

  const handleUpdateReviewField = (fieldName: string, value: string) => {
    const numericValue = value === '' ? 0 : parseFloat(value.replace(/\s/g, '')) || 0;
    setReviewData((prev: any) => ({
      ...prev,
      [fieldName]: numericValue
    }));
  };

  const handleCancelReview = () => {
    setShowReviewMode(false);
    setReviewData({});
  };


  const handleRetry = () => {
    if (uploadedFile) {
      setExtractedData(null);
      setError(null);
      processFile(uploadedFile);
    }
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setExtractedData(null);
    setError(null);
    setProcessingProgress(0);
    setProgressText('');
    setExtractedText('');
  };

  const getFieldCount = (data: any): number => {
    return Object.keys(data || {}).filter(key => 
      data[key] !== null && 
      data[key] !== undefined && 
      data[key] !== 0
    ).length;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'warning';
    return 'error';
  };

  // Get value with default 0 for missing fields
  const getFieldValue = (fieldKey: string) => {
    return reviewData[fieldKey] || 0;
  };

  // Calculate totals for hierarchical display
  const calculateTotal = (subFields: string[]) => {
    return subFields.reduce((sum, field) => sum + (getFieldValue(field) || 0), 0);
  };

  // Render hierarchical financial statements structure
  const renderFinancialStatementsHierarchy = () => {
    return (
      <Grid container spacing={3}>
        {/* BILAN Section */}
        <Grid item xs={12}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <BalanceIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  📊 BILAN
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* ACTIF IMMOBILISE */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        ACTIF IMMOBILISE ({new Intl.NumberFormat('fr-FR').format(
                          calculateTotal([
                            'frais_developpement', 'brevets_licences', 'fonds_commercial', 'autres_immob_incorporelles',
                            'terrains', 'batiments', 'agencements', 'materiel_mobilier', 'materiel_transport',
                            'avances_immobilisations', 'titres_participation', 'prets_immobilises'
                          ])
                        )})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {/* IMMOBILISATIONS INCORPORELLES Sub-section */}
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            IMMOBILISATIONS INCORPORELLES ({new Intl.NumberFormat('fr-FR').format(
                              calculateTotal(['frais_developpement', 'brevets_licences', 'fonds_commercial', 'autres_immob_incorporelles'])
                            )})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Frais de développement et de prospection"
                                type="number"
                                value={getFieldValue('frais_developpement')}
                                onChange={(e) => handleUpdateReviewField('frais_developpement', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Brevets, Licences, logiciels et droit similaire"
                                type="number"
                                value={getFieldValue('brevets_licences')}
                                onChange={(e) => handleUpdateReviewField('brevets_licences', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Fond commercial et droit au bail"
                                type="number"
                                value={getFieldValue('fonds_commercial')}
                                onChange={(e) => handleUpdateReviewField('fonds_commercial', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Autres immobilisations incorporelles"
                                type="number"
                                value={getFieldValue('autres_immob_incorporelles')}
                                onChange={(e) => handleUpdateReviewField('autres_immob_incorporelles', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>

                      {/* IMMOBILISATIONS CORPORELLES Sub-section */}
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            IMMOBILISATIONS CORPORELLES ({new Intl.NumberFormat('fr-FR').format(
                              calculateTotal(['terrains', 'batiments', 'agencements', 'materiel_mobilier', 'materiel_transport', 'avances_immobilisations'])
                            )})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Terrains"
                                type="number"
                                value={getFieldValue('terrains')}
                                onChange={(e) => handleUpdateReviewField('terrains', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Bâtiments"
                                type="number"
                                value={getFieldValue('batiments')}
                                onChange={(e) => handleUpdateReviewField('batiments', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Agencements, aménagement et Installations"
                                type="number"
                                value={getFieldValue('agencements')}
                                onChange={(e) => handleUpdateReviewField('agencements', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Matériel mobilier et actifs biologiques"
                                type="number"
                                value={getFieldValue('materiel_mobilier')}
                                onChange={(e) => handleUpdateReviewField('materiel_mobilier', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Matériel de transport"
                                type="number"
                                value={getFieldValue('materiel_transport')}
                                onChange={(e) => handleUpdateReviewField('materiel_transport', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Avances et acomptes versées sur immobilisations"
                                type="number"
                                value={getFieldValue('avances_immobilisations')}
                                onChange={(e) => handleUpdateReviewField('avances_immobilisations', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>

                      {/* IMMOBILISATIONS FINANCIERES Sub-section */}
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            IMMOBILISATIONS FINANCIÈRES ({new Intl.NumberFormat('fr-FR').format(
                              calculateTotal(['titres_participation', 'prets_immobilises'])
                            )})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Titres de participation"
                                type="number"
                                value={getFieldValue('titres_participation')}
                                onChange={(e) => handleUpdateReviewField('titres_participation', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Prêts et créances immobilisés"
                                type="number"
                                value={getFieldValue('prets_immobilises')}
                                onChange={(e) => handleUpdateReviewField('prets_immobilises', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* ACTIF CIRCULANT */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        ACTIF CIRCULANT ({new Intl.NumberFormat('fr-FR').format(
                          calculateTotal(['actif_circulant_hao', 'stocks', 'fournisseurs_avances', 'clients', 'autres_creances'])
                        )})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="ACTIF CIRCULANT HAO"
                            type="number"
                            value={getFieldValue('actif_circulant_hao')}
                            onChange={(e) => handleUpdateReviewField('actif_circulant_hao', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="STOCKS ET ENCOURS"
                            type="number"
                            value={getFieldValue('stocks')}
                            onChange={(e) => handleUpdateReviewField('stocks', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Fournisseurs avances versées"
                            type="number"
                            value={getFieldValue('fournisseurs_avances')}
                            onChange={(e) => handleUpdateReviewField('fournisseurs_avances', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Clients"
                            type="number"
                            value={getFieldValue('clients')}
                            onChange={(e) => handleUpdateReviewField('clients', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Autres créances"
                            type="number"
                            value={getFieldValue('autres_creances')}
                            onChange={(e) => handleUpdateReviewField('autres_creances', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* TRÉSORERIE ACTIF (separate section) */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        TRÉSORERIE ACTIF ({new Intl.NumberFormat('fr-FR').format(
                          calculateTotal(['titres_placement', 'valeurs_encaisser', 'banques_caisses'])
                        )})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Titres de placement"
                            type="number"
                            value={getFieldValue('titres_placement')}
                            onChange={(e) => handleUpdateReviewField('titres_placement', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Valeurs à encaisser"
                            type="number"
                            value={getFieldValue('valeurs_encaisser')}
                            onChange={(e) => handleUpdateReviewField('valeurs_encaisser', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Banques, chèques postaux, caisses et assimilés"
                            type="number"
                            value={getFieldValue('banques_caisses')}
                            onChange={(e) => handleUpdateReviewField('banques_caisses', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* PASSIF Section */}
        <Grid item xs={12}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LiabilitiesIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                  📊 PASSIF
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* RESSOURCES STABLES (First Level) */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        RESSOURCES STABLES ({new Intl.NumberFormat('fr-FR').format(
                          calculateTotal([
                            'capital_social', 'actionnaires_capital', 'primes_capital', 'ecarts_reevaluation',
                            'reserves_indisponibles', 'reserves_libres', 'reserves_reportees', 'resultat_exercice',
                            'subventions_investissement', 'provisions_reglementees',
                            'emprunts_dettes_financieres', 'dettes_location', 'provisions_financieres'
                          ])
                        )})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {/* CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES (Second Level) */}
                      <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES ({new Intl.NumberFormat('fr-FR').format(
                              calculateTotal([
                                'capital_social', 'actionnaires_capital', 'primes_capital', 'ecarts_reevaluation',
                                'reserves_indisponibles', 'reserves_libres', 'reserves_reportees', 'resultat_exercice',
                                'subventions_investissement', 'provisions_reglementees'
                              ])
                            )})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Capital"
                                type="number"
                                value={getFieldValue('capital_social')}
                                onChange={(e) => handleUpdateReviewField('capital_social', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Apporteurs capital non appelé"
                                type="number"
                                value={getFieldValue('actionnaires_capital')}
                                onChange={(e) => handleUpdateReviewField('actionnaires_capital', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Primes liées au capital"
                                type="number"
                                value={getFieldValue('primes_capital')}
                                onChange={(e) => handleUpdateReviewField('primes_capital', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Ecarts de Réévaluation"
                                type="number"
                                value={getFieldValue('ecarts_reevaluation')}
                                onChange={(e) => handleUpdateReviewField('ecarts_reevaluation', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Réserves Indisponibles"
                                type="number"
                                value={getFieldValue('reserves_indisponibles')}
                                onChange={(e) => handleUpdateReviewField('reserves_indisponibles', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Réserves Libres"
                                type="number"
                                value={getFieldValue('reserves_libres')}
                                onChange={(e) => handleUpdateReviewField('reserves_libres', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Report à nouveau (+ ou -)"
                                type="number"
                                value={getFieldValue('reserves_reportees')}
                                onChange={(e) => handleUpdateReviewField('reserves_reportees', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Résultat net de l'exercice (bénéfice + ou perte -)"
                                type="number"
                                value={getFieldValue('resultat_exercice')}
                                onChange={(e) => handleUpdateReviewField('resultat_exercice', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Subventions d'Investissement"
                                type="number"
                                value={getFieldValue('subventions_investissement')}
                                onChange={(e) => handleUpdateReviewField('subventions_investissement', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Provision Réglementées"
                                type="number"
                                value={getFieldValue('provisions_reglementees')}
                                onChange={(e) => handleUpdateReviewField('provisions_reglementees', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>

                      {/* DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES (Second Level) */}
                      <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES ({new Intl.NumberFormat('fr-FR').format(
                              calculateTotal(['emprunts_dettes_financieres', 'dettes_location', 'provisions_financieres'])
                            )})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Emprunts et dettes financières diverses"
                                type="number"
                                value={getFieldValue('emprunts_dettes_financieres')}
                                onChange={(e) => handleUpdateReviewField('emprunts_dettes_financieres', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Dettes de location acquistion"
                                type="number"
                                value={getFieldValue('dettes_location')}
                                onChange={(e) => handleUpdateReviewField('dettes_location', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Provisions financières pour Risques et Charges"
                                type="number"
                                value={getFieldValue('provisions_financieres')}
                                onChange={(e) => handleUpdateReviewField('provisions_financieres', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* PASSIF CIRCULANT (First Level) */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        PASSIF CIRCULANT ({new Intl.NumberFormat('fr-FR').format(
                          calculateTotal([
                            'dettes_circulantes_hao', 'clients_avances_recues', 'dettes_fournisseurs',
                            'dettes_sociales_fiscales', 'autres_dettes', 'provisions_court_terme'
                          ])
                        )})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Dettes circulantes HAO"
                            type="number"
                            value={getFieldValue('dettes_circulantes_hao')}
                            onChange={(e) => handleUpdateReviewField('dettes_circulantes_hao', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Clients Avances Reçues"
                            type="number"
                            value={getFieldValue('clients_avances_recues')}
                            onChange={(e) => handleUpdateReviewField('clients_avances_recues', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Fournisseurs d'Exploitation"
                            type="number"
                            value={getFieldValue('dettes_fournisseurs')}
                            onChange={(e) => handleUpdateReviewField('dettes_fournisseurs', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Dettes fiscales et sociales"
                            type="number"
                            value={getFieldValue('dettes_sociales_fiscales')}
                            onChange={(e) => handleUpdateReviewField('dettes_sociales_fiscales', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Autres Dettes"
                            type="number"
                            value={getFieldValue('autres_dettes')}
                            onChange={(e) => handleUpdateReviewField('autres_dettes', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Provision pour risques à court termes"
                            type="number"
                            value={getFieldValue('provisions_court_terme')}
                            onChange={(e) => handleUpdateReviewField('provisions_court_terme', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* TRÉSORERIE PASSIF (First Level) */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        TRÉSORERIE PASSIF ({new Intl.NumberFormat('fr-FR').format(
                          calculateTotal(['banques_credits_escompte', 'banques_credits_tresorerie'])
                        )})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Banques, crédits d'escompte"
                            type="number"
                            value={getFieldValue('banques_credits_escompte')}
                            onChange={(e) => handleUpdateReviewField('banques_credits_escompte', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Banques, établissements financiers et crédits de trésorerie"
                            type="number"
                            value={getFieldValue('banques_credits_tresorerie')}
                            onChange={(e) => handleUpdateReviewField('banques_credits_tresorerie', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* COMPTE DE RESULTAT Section */}
        <Grid item xs={12}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IncomeIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                  💰 COMPTE DE RÉSULTAT
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* PRODUITS D'EXPLOITATION */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        PRODUITS D'EXPLOITATION ({new Intl.NumberFormat('fr-FR').format(
                          calculateTotal(['chiffre_affaires', 'ventes_marchandises', 'production_vendue', 'autres_produits_exploitation'])
                        )})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Chiffre d'affaires"
                            type="number"
                            value={getFieldValue('chiffre_affaires')}
                            onChange={(e) => handleUpdateReviewField('chiffre_affaires', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Ventes de marchandises"
                            type="number"
                            value={getFieldValue('ventes_marchandises')}
                            onChange={(e) => handleUpdateReviewField('ventes_marchandises', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Production vendue"
                            type="number"
                            value={getFieldValue('production_vendue')}
                            onChange={(e) => handleUpdateReviewField('production_vendue', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Autres produits d'exploitation"
                            type="number"
                            value={getFieldValue('autres_produits_exploitation')}
                            onChange={(e) => handleUpdateReviewField('autres_produits_exploitation', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* CHARGES D'EXPLOITATION */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        CHARGES D'EXPLOITATION ({new Intl.NumberFormat('fr-FR').format(
                          calculateTotal(['achats_marchandises', 'services_exterieurs', 'charges_personnel', 'dotations_amortissements', 'autres_charges_exploitation'])
                        )})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Achats de marchandises"
                            type="number"
                            value={getFieldValue('achats_marchandises')}
                            onChange={(e) => handleUpdateReviewField('achats_marchandises', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Services extérieurs"
                            type="number"
                            value={getFieldValue('services_exterieurs')}
                            onChange={(e) => handleUpdateReviewField('services_exterieurs', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Charges de personnel"
                            type="number"
                            value={getFieldValue('charges_personnel')}
                            onChange={(e) => handleUpdateReviewField('charges_personnel', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Dotations aux amortissements"
                            type="number"
                            value={getFieldValue('dotations_amortissements')}
                            onChange={(e) => handleUpdateReviewField('dotations_amortissements', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Autres charges d'exploitation"
                            type="number"
                            value={getFieldValue('autres_charges_exploitation')}
                            onChange={(e) => handleUpdateReviewField('autres_charges_exploitation', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* TABLEAU DE FLUX DE TRÉSORERIE Section */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CashFlowIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'warning.main' }}>
                  📈 TABLEAU DE FLUX DE TRÉSORERIE
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Trésorerie début de période"
                    type="number"
                    value={getFieldValue('tresorerie_debut_periode')}
                    onChange={(e) => handleUpdateReviewField('tresorerie_debut_periode', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Trésorerie fin de période"
                    type="number"
                    value={getFieldValue('tresorerie_fin_periode')}
                    onChange={(e) => handleUpdateReviewField('tresorerie_fin_periode', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Variation de trésorerie"
                    type="number"
                    value={getFieldValue('variation_tresorerie')}
                    onChange={(e) => handleUpdateReviewField('variation_tresorerie', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Flux de trésorerie d'activité"
                    type="number"
                    value={getFieldValue('flux_tresorerie_activite')}
                    onChange={(e) => handleUpdateReviewField('flux_tresorerie_activite', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Flux de trésorerie d'investissement"
                    type="number"
                    value={getFieldValue('flux_tresorerie_investissement')}
                    onChange={(e) => handleUpdateReviewField('flux_tresorerie_investissement', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Flux de trésorerie de financement"
                    type="number"
                    value={getFieldValue('flux_tresorerie_financement')}
                    onChange={(e) => handleUpdateReviewField('flux_tresorerie_financement', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📸 Reconnaissance OCR de Documents PDF
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Importez un document PDF contenant des états financiers au format OHADA. 
        L'OCR analysera automatiquement toutes les pages pour extraire les données financières.
      </Typography>

      {/* Upload Area */}
      {!uploadedFile && (
        <Card
          {...getRootProps()}
          sx={{
            p: 4,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            bgcolor: isDragActive ? 'primary.50' : 'grey.50',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'primary.50',
            },
          }}
        >
          <input {...getInputProps()} />
          <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Déposez le fichier PDF ici' : 'Cliquez ou glissez un fichier PDF'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Formats acceptés: PDF uniquement • Taille max: 10MB
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
            L'OCR analysera toutes les pages du document pour trouver les états financiers
          </Typography>
        </Card>
      )}

      {/* File Processing */}
      {uploadedFile && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FileIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {uploadedFile.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                </Typography>
              </Box>
              <Button
                onClick={resetUpload}
                size="small"
                color="secondary"
                disabled={isProcessing}
              >
                Changer de fichier
              </Button>
            </Box>

            {/* Progress */}
            {isProcessing && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {progressText}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {processingProgress}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={processingProgress} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}

            {/* Error */}
            {error && !isProcessing && (
              <Alert 
                severity="error" 
                sx={{ mb: 2 }}
                action={
                  <IconButton onClick={handleRetry} size="small" color="inherit">
                    <RefreshIcon />
                  </IconButton>
                }
              >
                {error}
              </Alert>
            )}

            {/* Success with extracted data */}
            {extractedData && !isProcessing && !error && (
              <>
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    ✅ Extraction OCR terminée avec succès !
                  </Typography>
                  <Typography variant="body2">
                    {getFieldCount(extractedData.data)} champs extraits • 
                    Confiance: {extractedData.confidence}% • 
                    Année cible: {targetYear}
                  </Typography>
                </Alert>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={4}>
                    <Chip
                      icon={<CheckIcon />}
                      label={`${getFieldCount(extractedData.data)} champs extraits`}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Chip
                      label={`Confiance: ${extractedData.confidence}%`}
                      color={getConfidenceColor(extractedData.confidence || 0)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Chip
                      label={`Année: ${targetYear}`}
                      color="default"
                      size="small"
                    />
                  </Grid>
                </Grid>

                {/* Extracted Fields Preview */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Champs extraits:
                  </Typography>
                  <List dense sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    {Object.entries(extractedData.data).map(([key, value]) => (
                      <ListItem key={key} sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          secondary={typeof value === 'number' ? 
                            new Intl.NumberFormat('fr-FR').format(value) : 
                            String(value)
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    startIcon={<ViewIcon />}
                    onClick={() => setShowPreview(true)}
                  >
                    Voir le texte extrait
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRetry}
                  >
                    Retraiter
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<CheckIcon />}
                    onClick={handleReviewData}
                    sx={{ fontWeight: 600 }}
                  >
                    Réviser et éditer les données
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Review Interface */}
      {showReviewMode && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              📝 Révision et édition des données extraites
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Vérifiez et modifiez les données extraites avant de procéder à l'analyse. 
              Les valeurs numériques doivent être saisies sans espaces (ex: 1000000 au lieu de 1 000 000).
            </Typography>

            {/* Hierarchical Structure with All Excel Fields */}
            {renderFinancialStatementsHierarchy()}

            <Divider sx={{ my: 3 }} />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={handleCancelReview}
              >
                Annuler
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={handleConfirmReviewedData}
                sx={{ fontWeight: 600 }}
              >
                Utiliser ces données pour l'analyse
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Text Preview Dialog */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Texte extrait par OCR
        </DialogTitle>
        <DialogContent>
          <Typography
            component="pre"
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              maxHeight: '60vh',
              overflow: 'auto',
              bgcolor: 'grey.100',
              p: 2,
              borderRadius: 1,
            }}
          >
            {extractedText}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Instructions */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          📋 Instructions pour de meilleurs résultats:
        </Typography>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>Assurez-vous que le document PDF est de bonne qualité</li>
          <li>Les états financiers doivent être au format OHADA standard</li>
          <li>L'OCR fonctionne mieux avec des documents scannés à haute résolution</li>
          <li>Vérifiez les données extraites avant de les utiliser</li>
        </ul>
      </Alert>
    </Box>
  );
};