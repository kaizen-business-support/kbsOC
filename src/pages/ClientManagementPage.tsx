import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Avatar,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  AccountBalance as BankIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Analytics as AnalysisIcon,
} from '@mui/icons-material';
import { ApiService } from '../services/api';

interface ClientManagementPageProps {
  onNavigate: (page: any) => void;
}

interface Client {
  id: string;
  name: string;
  rccm: string;
  ninea: string;
  cofi: string;
  industry: string;
  branch: string;
  relationshipManager: string;
  createdDate: string;
  status: 'active' | 'inactive' | 'pending';
}

interface Shareholder {
  id: string;
  name: string;
  type: 'individual' | 'corporate';
  ownership: number;
  nationalId?: string;
  tin?: string;
  rccm?: string;
}

const industries = [
  'Agriculture et Agrobusiness',
  'Manufacture et Industrie',
  'Commerce et Distribution',
  'Services et Professionnel',
  'Technologie et Innovation',
  'Tourisme et Hôtellerie',
  'Transport et Logistique',
];

export const ClientManagementPage: React.FC<ClientManagementPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Load clients from API on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoading(true);
        const response = await ApiService.getClients();
        if (response.success && response.data) {
          // Map API response to frontend Client interface
          const mappedClients: Client[] = response.data.map((client: any) => ({
            id: client.id,
            name: client.companyName,
            rccm: client.rccm || 'N/A',
            ninea: client.ninea || 'N/A',
            cofi: client.legalForm || 'N/A',
            industry: client.sector || 'Non spécifié',
            branch: client.creator?.department || 'Non spécifié',
            relationshipManager: client.creator?.name || 'Non assigné',
            createdDate: client.createdAt ? new Date(client.createdAt).toISOString().split('T')[0] : '',
            status: client.isActive ? 'active' : 'inactive',
          }));
          setClients(mappedClients);
        }
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        setLoading(false);
      }
    };
    loadClients();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setOpenDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.rccm.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          {t('clients.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('clients.subtitle')}
        </Typography>
      </Box>

      {/* Main Content */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label="Liste des Clients" />
            <Tab label="Nouveau Client" />
            <Tab label="Import/Export" />
            <Tab label="Actionnaires" />
          </Tabs>
        </Box>

        <CardContent>
          {currentTab === 0 && (
            <Box>
              {/* Search and Actions */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <TextField
                  placeholder="Rechercher par nom ou RCCM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                  }}
                  sx={{ minWidth: 300 }}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCurrentTab(1)}
                >
                  Nouveau Client
                </Button>
              </Box>

              {/* Client Table */}
              <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e8ecf0', boxShadow: 'none' }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['Client', 'RCCM', 'NINEA', 'Secteur', 'Agence', "Chargé d'Affaires", 'Statut', 'Actions'].map((col) => (
                        <TableCell key={col} align={col === 'Actions' ? 'center' : 'left'} sx={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e8ecf0', py: 1.5 }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow
                        key={client.id}
                        sx={{
                          borderBottom: '1px solid #f1f5f9',
                          '&:last-child': { borderBottom: 'none' },
                          '&:hover': { bgcolor: 'rgba(31,78,121,0.03)', cursor: 'pointer' },
                        }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 30, height: 30 }}>
                              <BusinessIcon fontSize="small" />
                            </Avatar>
                            <Typography sx={{ fontSize: '13.5px', fontWeight: 500, color: '#374151' }}>
                              {client.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151', fontFamily: 'monospace' }}>{client.rccm}</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151', fontFamily: 'monospace' }}>{client.ninea}</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{client.industry}</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{client.branch}</TableCell>
                        <TableCell sx={{ py: 1.5, fontSize: '13.5px', color: '#374151' }}>{client.relationshipManager}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            label={client.status}
                            color={getStatusColor(client.status) as any}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleClientClick(client)}
                            color="primary"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="success"
                            onClick={() => onNavigate('credit-scoring')}
                          >
                            <AnalysisIcon />
                          </IconButton>
                          <IconButton size="small" color="default">
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" color="error">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {currentTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Création d'un Nouveau Client Corporatif
              </Typography>
              
              <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Raison Sociale *"
                    placeholder="Ex: SARL TECH SOLUTIONS"
                    required
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="RCCM *"
                    placeholder="Ex: SN-DKR-2020-B-1234"
                    helperText="Registre du Commerce et du Crédit Mobilier"
                    required
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="NINEA *"
                    placeholder="Ex: 0123456789"
                    helperText="Numéro d'Identification Nationale des Entreprises"
                    required
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Forme Juridique (COFI) *</InputLabel>
                    <Select label="Forme Juridique (COFI) *">
                      <MenuItem value="SARL">SARL - Société à Responsabilité Limitée</MenuItem>
                      <MenuItem value="SA">SA - Société Anonyme</MenuItem>
                      <MenuItem value="GIE">GIE - Groupement d'Intérêt Économique</MenuItem>
                      <MenuItem value="SNC">SNC - Société en Nom Collectif</MenuItem>
                      <MenuItem value="EI">EI - Entreprise Individuelle</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Secteur d'Activité *</InputLabel>
                    <Select label="Secteur d'Activité *">
                      {industries.map((industry) => (
                        <MenuItem key={industry} value={industry}>
                          {industry}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Agence de Rattachement *</InputLabel>
                    <Select label="Agence de Rattachement *">
                      <MenuItem value="Dakar Centre">Dakar Centre</MenuItem>
                      <MenuItem value="Dakar Plateau">Dakar Plateau</MenuItem>
                      <MenuItem value="Thiès">Thiès</MenuItem>
                      <MenuItem value="Kaolack">Kaolack</MenuItem>
                      <MenuItem value="Saint-Louis">Saint-Louis</MenuItem>
                      <MenuItem value="Ziguinchor">Ziguinchor</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Adresse Complète"
                    multiline
                    rows={3}
                    placeholder="Adresse du siège social de l'entreprise"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    placeholder="Ex: +221 33 123 45 67"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    placeholder="contact@entreprise.sn"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      onClick={() => setCurrentTab(0)}
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                    >
                      Créer le Client
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {currentTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Import/Export de Données Clients
              </Typography>
              
              <Grid container spacing={4} sx={{ mt: 2 }}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                      <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Import depuis Core Banking
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Synchronisation avec le système bancaire central
                      </Typography>
                      <Button variant="contained" startIcon={<BankIcon />}>
                        Synchroniser
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                      <UploadIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Import depuis Excel
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Format standardisé SYSCOHADA
                      </Typography>
                      <Button variant="outlined" startIcon={<UploadIcon />}>
                        Choisir Fichier
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {currentTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Gestion des Actionnaires
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Traçabilité complète des structures de propriété et détection des parties liées
              </Typography>

              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Module Actionnaires
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Fonctionnalité disponible après création des clients
                  </Typography>
                  <Button variant="outlined" disabled>
                    Gérer les Actionnaires
                  </Button>
                </CardContent>
              </Card>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Client Details Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Détails du Client
        </DialogTitle>
        <DialogContent>
          {selectedClient && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Raison Sociale</Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {selectedClient.name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">RCCM</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {selectedClient.rccm}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">NINEA</Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {selectedClient.ninea}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Forme Juridique</Typography>
                <Typography variant="body1">{selectedClient.cofi}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Secteur</Typography>
                <Typography variant="body1">{selectedClient.industry}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Agence</Typography>
                <Typography variant="body1">{selectedClient.branch}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Fermer</Button>
          <Button variant="contained" startIcon={<EditIcon />}>
            Modifier
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};