import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  LinearProgress,
  Avatar,
  Divider,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Description as DocumentIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Scanner as ScannerIcon,
  CheckCircle as VerifiedIcon,
  Info as InfoIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import Tesseract from 'tesseract.js';
import { RichTextEditor } from './RichTextEditor';

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  category: 'financial' | 'legal' | 'identity' | 'collateral' | 'other';
  uploadDate: Date;
  status: 'processing' | 'verified' | 'error' | 'pending';
  ocrText?: string;
  extractedData?: any;
  file?: File;
  previewUrl?: string;
}

interface DocumentManagerProps {
  clientId?: string;
  applicationId?: string;
  initialDocuments?: any[];
  onDocumentProcessed?: (document: DocumentFile) => void;
}

const documentCategories = {
  financial: {
    label: 'Documents Financiers',
    color: 'primary' as const,
    icon: <DocumentIcon />,
    acceptedTypes: ['.pdf', '.xlsx', '.xls', '.csv']
  },
  legal: {
    label: 'Documents Juridiques',
    color: 'secondary' as const,
    icon: <FolderIcon />,
    acceptedTypes: ['.pdf', '.doc', '.docx']
  },
  identity: {
    label: 'Pièces d\'Identité',
    color: 'info' as const,
    icon: <VerifiedIcon />,
    acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png']
  },
  collateral: {
    label: 'Garanties',
    color: 'warning' as const,
    icon: <InfoIcon />,
    acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png']
  },
  other: {
    label: 'Autres',
    color: 'default' as const,
    icon: <DocumentIcon />,
    acceptedTypes: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
  }
};

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  clientId,
  applicationId,
  initialDocuments = [],
  onDocumentProcessed
}) => {
  const [documents, setDocuments] = useState<DocumentFile[]>(initialDocuments);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof documentCategories>('financial');
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; document?: DocumentFile }>({ open: false });
  const [ocrProgress, setOcrProgress] = useState<{ [key: string]: number }>({});
  const [extractedText, setExtractedText] = useState<string>('');

  const extractFinancialData = (text: string) => {
    const patterns = {
      totalAssets: /total\s+actif[:\s]+(\d{1,3}(?:[,\s]\d{3})*)/i,
      totalLiabilities: /total\s+passif[:\s]+(\d{1,3}(?:[,\s]\d{3})*)/i,
      revenue: /chiffre\s+d'affaires?[:\s]+(\d{1,3}(?:[,\s]\d{3})*)/i,
      netIncome: /résultat\s+net[:\s]+(\d{1,3}(?:[,\s]\d{3})*)/i
    };

    const extractedData: any = {};

    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        const numericValue = match[1].replace(/[,\s]/g, '');
        extractedData[key] = parseInt(numericValue, 10);
      }
    });

    return Object.keys(extractedData).length > 0 ? extractedData : undefined;
  };

  const performOCR = async (file: File, documentId: string) => {
    try {
      setOcrProgress(prev => ({ ...prev, [documentId]: 0 }));

      const result = await Tesseract.recognize(
        file,
        'fra+eng',
        {
          logger: (info) => {
            if (info.status === 'recognizing text') {
              setOcrProgress(prev => ({ 
                ...prev, 
                [documentId]: Math.round(info.progress * 100) 
              }));
            }
          }
        }
      );

      const ocrText = result.data.text;
      const extractedData = extractFinancialData(ocrText);

      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { 
              ...doc, 
              status: 'verified' as const, 
              ocrText,
              extractedData 
            }
          : doc
      ));

      setOcrProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[documentId];
        return newProgress;
      });

      if (onDocumentProcessed) {
        const processedDoc = documents.find(d => d.id === documentId);
        if (processedDoc) {
          onDocumentProcessed({ 
            ...processedDoc, 
            status: 'verified', 
            ocrText, 
            extractedData 
          });
        }
      }
    } catch (error) {
      console.error('OCR Error:', error);
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, status: 'error' as const }
          : doc
      ));
      setOcrProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[documentId];
        return newProgress;
      });
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      const newDocument: DocumentFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        category: selectedCategory,
        uploadDate: new Date(),
        status: 'processing',
        file: file,
        previewUrl: previewUrl
      };

      setDocuments(prev => [...prev, newDocument]);

      // Only perform OCR on financial document images
      if (selectedCategory === 'financial' && file.type.startsWith('image/')) {
        performOCR(file, newDocument.id);
      } else {
        // Mark as verified immediately for non-financial docs or non-image files
        setTimeout(() => {
          setDocuments(prev => prev.map(doc =>
            doc.id === newDocument.id
              ? { ...doc, status: 'verified' as const }
              : doc
          ));
        }, 500);
      }
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.jpg', '.jpeg', '.png']
    },
    maxSize: 10485760 // 10MB
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: DocumentFile['status']) => {
    switch (status) {
      case 'verified': return 'success';
      case 'processing': return 'info';
      case 'error': return 'error';
      case 'pending': return 'warning';
      default: return 'primary';
    }
  };

  const getStatusLabel = (status: DocumentFile['status']) => {
    switch (status) {
      case 'verified': return 'Vérifié';
      case 'processing': return 'Traitement...';
      case 'error': return 'Erreur';
      case 'pending': return 'En attente';
      default: return 'Inconnu';
    }
  };

  const handlePreview = (document: DocumentFile) => {
    setPreviewDialog({ open: true, document });
    if (document.ocrText) {
      setExtractedText(document.ocrText);
    }
  };

  const handleDelete = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const filteredDocuments = documents.filter(doc => doc.category === selectedCategory);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          <ScannerIcon />
        </Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Gestion Documentaire
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload, OCR et extraction automatique de données
          </Typography>
        </Box>
      </Box>

      {/* Category Tabs */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {Object.entries(documentCategories).map(([key, category]) => (
          <Grid item xs={12} sm={6} md={2.4} key={key}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                border: selectedCategory === key ? 2 : 1,
                borderColor: selectedCategory === key ? 'primary.main' : 'divider',
                '&:hover': { borderColor: 'primary.main' }
              }}
              onClick={() => setSelectedCategory(key as keyof typeof documentCategories)}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: selectedCategory === key ? 'primary.main' : 'grey.100',
                    color: selectedCategory === key ? 'white' : 'text.secondary',
                    mx: 'auto', 
                    mb: 1,
                    width: 40,
                    height: 40
                  }}
                >
                  {category.icon}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {category.label}
                </Typography>
                <Chip 
                  label={documents.filter(d => d.category === key).length}
                  size="small"
                  color={category.color as any}
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Upload Area */}
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          mb: 4,
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragActive ? 'primary.50' : 'grey.50',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'primary.50'
          }
        }}
      >
        <input {...getInputProps()} />
        <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive ? 'Déposez vos fichiers ici' : 'Glissez-déposez vos documents'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Formats supportés: {documentCategories[selectedCategory].acceptedTypes.join(', ')}
        </Typography>
        <Typography variant="body2" color="primary.main" sx={{ mt: 1, fontWeight: 500 }}>
          ou cliquez n'importe où dans cette zone pour sélectionner des fichiers
        </Typography>
      </Paper>

      {/* Document List */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
              {documentCategories[selectedCategory].label}
            </Typography>
            <Chip 
              label={`${filteredDocuments.length} document(s)`}
              color={documentCategories[selectedCategory].color as any}
            />
          </Box>

          {filteredDocuments.length === 0 ? (
            <Alert severity="info" sx={{ textAlign: 'center' }}>
              <Typography variant="body2">
                Aucun document dans cette catégorie. Commencez par uploader des fichiers.
              </Typography>
            </Alert>
          ) : (
            <List>
              {filteredDocuments.map((document, index) => (
                <React.Fragment key={document.id}>
                  <ListItem>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: `${getStatusColor(document.status)}.100` }}>
                        <DocumentIcon color={getStatusColor(document.status) as any} />
                      </Avatar>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {document.name}
                          </Typography>
                          <Chip 
                            label={getStatusLabel(document.status)}
                            size="small"
                            color={getStatusColor(document.status) as any}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {formatFileSize(document.size)} • {document.uploadDate.toLocaleDateString('fr-FR')}
                          </Typography>
                          {ocrProgress[document.id] !== undefined && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Reconnaissance OCR: {ocrProgress[document.id]}%
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={ocrProgress[document.id]} 
                                sx={{ flexGrow: 1, height: 4, borderRadius: 2 }}
                              />
                            </Box>
                          )}
                          {document.extractedData && (
                            <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                              ✓ Données extraites automatiquement
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    
                    <ListItemSecondaryAction>
                      <IconButton 
                        size="small" 
                        onClick={() => handlePreview(document)}
                        disabled={document.status === 'processing'}
                      >
                        <ViewIcon />
                      </IconButton>
                      <IconButton size="small">
                        <DownloadIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDelete(document.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < filteredDocuments.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialog.open}
        onClose={() => setPreviewDialog({ open: false })}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Aperçu du Document - {previewDialog.document?.name}
        </DialogTitle>
        <DialogContent>
          {/* File Preview */}
          {previewDialog.document?.previewUrl && (
            <Box sx={{ mb: 3 }}>
              {previewDialog.document.type.startsWith('image/') ? (
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <img
                    src={previewDialog.document.previewUrl}
                    alt={previewDialog.document.name}
                    style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
                  />
                </Box>
              ) : previewDialog.document.type === 'application/pdf' ? (
                <Box sx={{ mb: 3, height: '600px' }}>
                  <iframe
                    src={previewDialog.document.previewUrl}
                    style={{ width: '100%', height: '100%', border: '1px solid #ddd' }}
                    title={previewDialog.document.name}
                  />
                </Box>
              ) : (
                <Alert severity="info">
                  Aperçu non disponible pour ce type de fichier. Utilisez le bouton de téléchargement pour voir le contenu.
                </Alert>
              )}
            </Box>
          )}

          {previewDialog.document?.ocrText && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Texte Extrait (OCR)
              </Typography>
              <RichTextEditor
                value={extractedText}
                onChange={(value) => setExtractedText(value)}
                height={200}
                label="Texte reconnu par OCR"
              />
            </Box>
          )}

          {previewDialog.document?.extractedData && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Données Financières Extraites
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(previewDialog.document.extractedData).map(([key, value]) => (
                  <Grid item xs={12} sm={6} key={key}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {key === 'totalAssets' ? 'Total Actif' :
                         key === 'totalLiabilities' ? 'Total Passif' :
                         key === 'revenue' ? 'Chiffre d\'Affaires' :
                         key === 'netIncome' ? 'Résultat Net' : key}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'XOF',
                          minimumFractionDigits: 0,
                        }).format(value as number)}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {previewDialog.document?.status === 'processing' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Traitement du document en cours...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog({ open: false })}>
            Fermer
          </Button>
          <Button variant="contained">
            Télécharger
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};