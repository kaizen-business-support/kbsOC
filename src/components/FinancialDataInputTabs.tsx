import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import {
  TableChart as ExcelIcon,
  EditNote as ManualIcon,
  CheckCircle as DoneIcon,
  DocumentScanner as OcrIcon,
  Lock as LockIcon,
  Rocket as RocketIcon,
} from '@mui/icons-material';
import { UploadPage } from '../pages/UploadPage';
import ManualInputPage from '../pages/ManualInputPage';

interface FinancialDataInputTabsProps {
  referenceYear: number;
  numberOfYears: number;
  selectedSector: string;
  currency: string;
  onDataInput: (year: number, data: any) => void;
  financialData: Record<number, any>;
  onDocumentUploaded?: (document: any) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

export const FinancialDataInputTabs: React.FC<FinancialDataInputTabsProps> = ({
  referenceYear,
  numberOfYears,
  selectedSector,
  currency,
  onDataInput,
  financialData,
  onDocumentUploaded,
}) => {
  const [activeDataTab, setActiveDataTab] = useState(0);
  const [activeYearTab, setActiveYearTab] = useState(0);

  const selectedYears = Array.from({ length: numberOfYears }, (_, i) => referenceYear - i)
    .sort((a, b) => b - a);

  const getYearLabel = (year: number) => {
    if (year === referenceYear) return `${year} (N)`;
    return `${year} (N-${referenceYear - year})`;
  };

  return (
    <Box>
      {/* Year pills */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        {selectedYears.map((year, i) => {
          const isDone = !!financialData[year];
          const isActive = i === activeYearTab;
          return (
            <Box
              key={year}
              onClick={() => setActiveYearTab(i)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2.5, py: 1.25,
                borderRadius: 3,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'all 0.2s ease',
                bgcolor: isActive ? 'primary.main' : isDone ? '#e8f5e9' : '#f1f5f9',
                color: isActive ? 'white' : isDone ? '#2e7d32' : '#64748b',
                boxShadow: isActive ? '0 4px 12px rgba(21,101,192,0.3)' : 'none',
                border: '2px solid',
                borderColor: isActive ? 'primary.main' : isDone ? '#a5d6a7' : 'transparent',
                '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
              }}
            >
              {isDone && <DoneIcon sx={{ fontSize: 16 }} />}
              {getYearLabel(year)}
            </Box>
          );
        })}
      </Box>

      {/* Content per year */}
      {selectedYears.map((year, yearIndex) => (
        <Box key={year} hidden={yearIndex !== activeYearTab}>
          {yearIndex === activeYearTab && (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                borderColor: 'rgba(0,0,0,0.08)',
              }}
            >
              {/* Input method tabs */}
              <Box sx={{ borderBottom: '1px solid', borderColor: 'rgba(0,0,0,0.08)', bgcolor: '#fafafa' }}>
                <Tabs
                  value={activeDataTab}
                  onChange={(_, v) => setActiveDataTab(v)}
                  sx={{
                    px: 2,
                    '& .MuiTab-root': { minHeight: 52, fontWeight: 600, fontSize: '0.875rem' },
                    '& .Mui-selected': { color: 'primary.main' },
                  }}
                >
                  <Tab
                    icon={<ExcelIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    label="Import Excel"
                  />
                  <Tab
                    icon={<ManualIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    label="Saisie Manuelle"
                  />
                  <Tab
                    icon={<OcrIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        OCR / IA
                        <Chip
                          icon={<LockIcon sx={{ fontSize: 11, '&&': { fontSize: 11 } }} />}
                          label="Bientôt"
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.65rem', fontWeight: 700,
                            bgcolor: '#fff3e0', color: '#e65100',
                            border: '1px solid #ffcc02',
                            '& .MuiChip-icon': { color: '#e65100', ml: 0.5 },
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      </Box>
                    }
                  />
                </Tabs>
              </Box>

              <Box sx={{ p: 3 }}>
                <TabPanel value={activeDataTab} index={0}>
                  <UploadPage
                    onNavigate={() => {}}
                    yearContext={{
                      year,
                      onComplete: (data: any) => onDataInput(year, data),
                    }}
                  />
                </TabPanel>

                <TabPanel value={activeDataTab} index={1}>
                  <ManualInputPage
                    onNavigate={() => {}}
                    yearContext={{
                      year,
                      onComplete: (data: any) => onDataInput(year, data),
                    }}
                  />
                </TabPanel>

                <TabPanel value={activeDataTab} index={2}>
                  <Box sx={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', py: 6, gap: 2.5,
                    background: 'linear-gradient(135deg, #fff8f0 0%, #fff3e0 100%)',
                    borderRadius: 3, border: '2px dashed #ffcc02',
                  }}>
                    <Box sx={{
                      width: 72, height: 72, borderRadius: '50%',
                      bgcolor: '#fff3e0', border: '2px solid #ffcc02',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <OcrIcon sx={{ fontSize: 34, color: '#e65100' }} />
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                        <LockIcon sx={{ fontSize: 18, color: '#e65100' }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#bf360c' }}>
                          Bientôt disponible
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#6d4c41', maxWidth: 360, lineHeight: 1.6 }}>
                        L'extraction automatique des états financiers par OCR et intelligence artificielle est en cours de développement.
                      </Typography>
                    </Box>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 2.5, py: 1, borderRadius: 5,
                      bgcolor: '#e65100', color: 'white',
                    }}>
                      <RocketIcon sx={{ fontSize: 16 }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                        Fonctionnalité verrouillée
                      </Typography>
                    </Box>
                  </Box>
                </TabPanel>
              </Box>

              {financialData[year] && (
                <Box sx={{ px: 3, pb: 2 }}>
                  <Chip
                    icon={<DoneIcon />}
                    label={`Données ${year} enregistrées`}
                    color="success"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              )}
            </Paper>
          )}
        </Box>
      ))}
    </Box>
  );
};
