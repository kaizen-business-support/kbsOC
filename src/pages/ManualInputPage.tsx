import React from 'react';
import { Box } from '@mui/material';
import { OhadaFinancialTable } from '../components/forms/OhadaFinancialTable';
import { PageType } from '../types';

interface ManualInputPageProps {
  onNavigate: (page: PageType) => void;
  yearContext?: {
    year: number;
    onComplete: (data: any) => void;
  };
}

const ManualInputPage: React.FC<ManualInputPageProps> = ({ onNavigate, yearContext }) => {
  const year = yearContext?.year ?? new Date().getFullYear();

  const handleComplete = (data: any) => {
    if (yearContext?.onComplete) {
      yearContext.onComplete(data);
    } else {
      onNavigate('analysis');
    }
  };

  return (
    <Box>
      <OhadaFinancialTable year={year} onComplete={handleComplete} />
    </Box>
  );
};

export default ManualInputPage;
