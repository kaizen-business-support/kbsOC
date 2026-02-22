import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Alert,
  Typography,
} from '@mui/material';
import { UploadPage } from '../pages/UploadPage';
import ManualInputPage from '../pages/ManualInputPage';
import { OcrUpload } from './OcrUpload';

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

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

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

  // Calculate the years based on reference year and number of years
  const getSelectedYears = () => {
    const years = [];
    for (let i = 0; i < numberOfYears; i++) {
      years.push(referenceYear - i);
    }
    return years.sort((a, b) => b - a); // Sort descending (most recent first)
  };

  const selectedYears = getSelectedYears();

  const getYearLabel = (year: number) => {
    if (year === referenceYear) return `${year} (N)`;
    const diff = referenceYear - year;
    return `${year} (N-${diff})`;
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Vous pouvez importer les données financières de trois façons :
          <strong> OCR</strong> (scan de documents),
          <strong> Excel</strong> (import de fichier), ou
          <strong> Saisie Manuelle</strong>.
        </Typography>
      </Alert>

      {/* Year Tabs */}
      <Tabs
        value={activeYearTab}
        onChange={(_, newValue) => setActiveYearTab(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        {selectedYears.map((year, index) => (
          <Tab
            key={year}
            label={getYearLabel(year)}
            icon={financialData[year] ? '✓' : undefined}
            iconPosition="end"
          />
        ))}
      </Tabs>

      {selectedYears.map((year, yearIndex) => (
        <TabPanel key={year} value={activeYearTab} index={yearIndex}>
          {/* Input Method Tabs */}
          <Tabs
            value={activeDataTab}
            onChange={(_, newValue) => setActiveDataTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            <Tab label="📄 Import Excel" />
            <Tab label="✍️ Saisie Manuelle" />
            <Tab label="📷 OCR (Scan)" />
          </Tabs>

          {/* Excel Upload Tab */}
          <TabPanel value={activeDataTab} index={0}>
            <UploadPage
              onNavigate={() => {}}
              yearContext={{
                year: year,
                onComplete: (data: any) => onDataInput(year, data)
              }}
            />
          </TabPanel>

          {/* Manual Input Tab */}
          <TabPanel value={activeDataTab} index={1}>
            <ManualInputPage
              onNavigate={() => {}}
              yearContext={{
                year: year,
                onComplete: (data: any) => onDataInput(year, data)
              }}
            />
          </TabPanel>

          {/* OCR Tab */}
          <TabPanel value={activeDataTab} index={2}>
            <OcrUpload
              onDataExtracted={(data: any) => onDataInput(year, data)}
              onDocumentUploaded={onDocumentUploaded}
              targetYear={year}
            />
          </TabPanel>
        </TabPanel>
      ))}
    </Box>
  );
};
