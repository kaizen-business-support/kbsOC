import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  FormControlLabel,
  Switch,
  Alert,
  Tabs,
  Tab,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  CalendarToday as CalendarIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useUser } from '../contexts/UserContext';
import { BankHoliday, WorkdayConfiguration } from '../types';
import { DEFAULT_WORKDAY_CONFIG, loadWorkdayConfiguration, saveWorkdayConfiguration } from '../utils/workdayUtils';

interface BankHolidaysAdminPageProps {
  onNavigate: (page: any) => void;
}

export const BankHolidaysAdminPage: React.FC<BankHolidaysAdminPageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { isRole } = useUser();

  // Check if user has access to bank holidays configuration
  const canViewBankHolidays = isRole('admin') || isRole('management');
  const canEditBankHolidays = isRole('admin');
  const [currentTab, setCurrentTab] = useState(0);
  const [workdayConfig, setWorkdayConfig] = useState<WorkdayConfiguration>(DEFAULT_WORKDAY_CONFIG);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<BankHoliday[]>([]);
  
  // Dialog states
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<BankHoliday | null>(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    isRecurring: false,
    description: ''
  });

  // Generate years for selection (current year ± 5 years)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  // Load configuration on mount
  useEffect(() => {
    const config = loadWorkdayConfiguration();
    setWorkdayConfig(config);
    setHolidays(config.holidays);
  }, []);

  // Filter holidays by selected year
  const yearHolidays = holidays.filter(holiday => holiday.year === selectedYear);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleSaveConfiguration = () => {
    const updatedConfig = {
      ...workdayConfig,
      holidays
    };
    setWorkdayConfig(updatedConfig);
    saveWorkdayConfiguration(updatedConfig);
  };

  const openHolidayDialog = (holiday?: BankHoliday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setHolidayForm({
        name: holiday.name,
        date: holiday.date,
        isRecurring: holiday.isRecurring,
        description: holiday.description || ''
      });
    } else {
      setEditingHoliday(null);
      setHolidayForm({
        name: '',
        date: `${selectedYear}-01-01`,
        isRecurring: false,
        description: ''
      });
    }
    setHolidayDialogOpen(true);
  };

  const closeHolidayDialog = () => {
    setHolidayDialogOpen(false);
    setEditingHoliday(null);
    setHolidayForm({
      name: '',
      date: '',
      isRecurring: false,
      description: ''
    });
  };

  const saveHoliday = () => {
    const holidayData: BankHoliday = {
      id: editingHoliday?.id || `holiday-${Date.now()}`,
      name: holidayForm.name,
      date: holidayForm.date,
      year: new Date(holidayForm.date).getFullYear(),
      isRecurring: holidayForm.isRecurring,
      description: holidayForm.description
    };

    if (editingHoliday) {
      // Update existing holiday
      setHolidays(holidays.map(h => h.id === editingHoliday.id ? holidayData : h));
    } else {
      // Add new holiday
      setHolidays([...holidays, holidayData]);
    }

    closeHolidayDialog();
  };

  const deleteHoliday = (holidayId: string) => {
    setHolidays(holidays.filter(h => h.id !== holidayId));
  };

  const copyHolidaysToYear = (fromYear: number, toYear: number) => {
    const recurringHolidays = holidays
      .filter(h => h.year === fromYear && h.isRecurring)
      .map(h => ({
        ...h,
        id: `holiday-${Date.now()}-${Math.random()}`,
        year: toYear,
        date: h.date.replace(fromYear.toString(), toYear.toString())
      }));
    
    // Remove existing holidays for the target year and add new ones
    const otherYearHolidays = holidays.filter(h => h.year !== toYear);
    setHolidays([...otherYearHolidays, ...recurringHolidays]);
  };

  if (!canViewBankHolidays) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Accès non autorisé. Seuls les administrateurs et la direction générale peuvent accéder à cette page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
          Gestion des Jours Fériés
          {!canEditBankHolidays && (
            <Chip
              icon={<VisibilityIcon />}
              label="Lecture seule"
              size="small"
              variant="outlined"
              sx={{ ml: 2 }}
            />
          )}
          {canEditBankHolidays && (
            <Chip
              icon={<LockIcon />}
              label="Administration"
              size="small"
              color="primary"
              sx={{ ml: 2 }}
            />
          )}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configuration des jours fériés et paramètres de calcul des jours ouvrables
        </Typography>
      </Box>

      {/* Tabs */}
      <Card sx={{ mb: 4 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange}>
            <Tab label="Jours Fériés" icon={<EventIcon />} />
            <Tab label="Configuration" icon={<SettingsIcon />} />
          </Tabs>
        </Box>
      </Card>

      {/* Holidays Tab */}
      {currentTab === 0 && (
        <Grid container spacing={3}>
          {/* Controls */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Année</InputLabel>
                      <Select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value as number)}
                        label="Année"
                      >
                        {availableYears.map(year => (
                          <MenuItem key={year} value={year}>{year}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <Typography variant="body2" color="text.secondary">
                      {yearHolidays.length} jour{yearHolidays.length > 1 ? 's' : ''} férié{yearHolidays.length > 1 ? 's' : ''}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={() => copyHolidaysToYear(selectedYear - 1, selectedYear)}
                      disabled={!canEditBankHolidays || selectedYear === availableYears[0]}
                    >
                      Copier depuis {selectedYear - 1}
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => openHolidayDialog()}
                      disabled={!canEditBankHolidays}
                    >
                      Ajouter Jour Férié
                    </Button>
                  </Box>
                </Box>

                {yearHolidays.length === 0 ? (
                  <Alert severity="info">
                    Aucun jour férié configuré pour l'année {selectedYear}
                  </Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Nom</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {yearHolidays
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((holiday) => (
                            <TableRow key={holiday.id}>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <CalendarIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                                  {new Date(holiday.date).toLocaleDateString('fr-FR')}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {holiday.name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {holiday.description || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={holiday.isRecurring ? 'Récurrent' : 'Unique'}
                                  size="small"
                                  color={holiday.isRecurring ? 'primary' : 'default'}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  onClick={() => openHolidayDialog(holiday)}
                                  disabled={!canEditBankHolidays}
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => deleteHoliday(holiday.id)}
                                  disabled={!canEditBankHolidays}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Configuration Tab */}
      {currentTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Jours Ouvrables Standard
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Nombre de jours ouvrables standard pour le traitement des dossiers de crédit
                </Typography>
                
                <TextField
                  fullWidth
                  label="Nombre de jours standard"
                  type="number"
                  value={workdayConfig.standardWorkdays}
                  onChange={(e) => setWorkdayConfig({
                    ...workdayConfig,
                    standardWorkdays: parseInt(e.target.value) || 3
                  })}
                  inputProps={{ min: 1, max: 10 }}
                  helperText="Défaut: 3 jours ouvrables"
                  disabled={!canEditBankHolidays}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Heures de Travail
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Définir les heures de travail pour le calcul des durées
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Heure de début"
                      type="time"
                      value={workdayConfig.workingHours.start}
                      onChange={(e) => setWorkdayConfig({
                        ...workdayConfig,
                        workingHours: {
                          ...workdayConfig.workingHours,
                          start: e.target.value
                        }
                      })}
                      InputLabelProps={{ shrink: true }}
                      disabled={!canEditBankHolidays}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Heure de fin"
                      type="time"
                      value={workdayConfig.workingHours.end}
                      onChange={(e) => setWorkdayConfig({
                        ...workdayConfig,
                        workingHours: {
                          ...workdayConfig.workingHours,
                          end: e.target.value
                        }
                      })}
                      InputLabelProps={{ shrink: true }}
                      disabled={!canEditBankHolidays}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Jours Travaillés
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Sélectionner les jours de la semaine considérés comme jours ouvrables
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {[
                    { day: 1, name: 'Lundi' },
                    { day: 2, name: 'Mardi' },
                    { day: 3, name: 'Mercredi' },
                    { day: 4, name: 'Jeudi' },
                    { day: 5, name: 'Vendredi' },
                    { day: 6, name: 'Samedi' },
                    { day: 0, name: 'Dimanche' }
                  ].map(({ day, name }) => (
                    <FormControlLabel
                      key={day}
                      control={
                        <Switch
                          checked={workdayConfig.workingDays.includes(day)}
                          onChange={(e) => {
                            const newWorkingDays = e.target.checked
                              ? [...workdayConfig.workingDays, day]
                              : workdayConfig.workingDays.filter(d => d !== day);
                            setWorkdayConfig({
                              ...workdayConfig,
                              workingDays: newWorkingDays.sort()
                            });
                          }}
                          disabled={!canEditBankHolidays}
                        />
                      }
                      label={name}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => onNavigate('settings')}>
                Annuler
              </Button>
              <Button 
                variant="contained" 
                startIcon={<SaveIcon />}
                onClick={handleSaveConfiguration}
                disabled={!canEditBankHolidays}
              >
                Sauvegarder Configuration
              </Button>
            </Box>
          </Grid>
        </Grid>
      )}

      {/* Holiday Dialog */}
      <Dialog open={holidayDialogOpen} onClose={closeHolidayDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingHoliday ? 'Modifier le Jour Férié' : 'Ajouter un Jour Férié'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nom du jour férié"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({
                  ...holidayForm,
                  name: e.target.value
                })}
                placeholder="Ex: Fête de l'Indépendance"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm({
                  ...holidayForm,
                  date: e.target.value
                })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={holidayForm.isRecurring}
                    onChange={(e) => setHolidayForm({
                      ...holidayForm,
                      isRecurring: e.target.checked
                    })}
                  />
                }
                label="Récurrent chaque année"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description (optionnel)"
                multiline
                rows={2}
                value={holidayForm.description}
                onChange={(e) => setHolidayForm({
                  ...holidayForm,
                  description: e.target.value
                })}
                placeholder="Description ou commentaires supplémentaires"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeHolidayDialog} startIcon={<CancelIcon />}>
            Annuler
          </Button>
          <Button 
            onClick={saveHoliday} 
            variant="contained" 
            startIcon={<SaveIcon />}
            disabled={!holidayForm.name || !holidayForm.date}
          >
            {editingHoliday ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};