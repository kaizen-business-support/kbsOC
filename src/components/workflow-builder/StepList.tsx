import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { PolicyStep, CreditType } from '../../types/creditPolicyBuilder';
import { StepConfigPanel } from './StepConfigPanel';

interface Props {
  steps: PolicyStep[];
  onStepsChange: (steps: PolicyStep[]) => void;
  creditTypes: CreditType[];
  readOnly?: boolean;
}

export function StepList({ steps, onStepsChange, creditTypes, readOnly = false }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  const updateStep = (id: string, patch: Partial<PolicyStep>) => {
    onStepsChange(steps.map((s) => s.id === id ? { ...s, ...patch } : s));
  };

  const deleteStep = (id: string) => {
    const filtered = steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
    onStepsChange(filtered);
    if (expandedId === id) setExpandedId(null);
  };

  const handleDragStart = (idx: number) => setDraggingIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };

  const handleDrop = (toIdx: number) => {
    if (draggingIdx === null || draggingIdx === toIdx) {
      setDraggingIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...steps];
    const [moved] = reordered.splice(draggingIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onStepsChange(reordered.map((s, i) => ({ ...s, order: i + 1 })));
    setDraggingIdx(null);
    setOverIdx(null);
  };

  if (steps.length === 0) {
    return (
      <Box sx={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        p: 4, border: '2px dashed #ccc', borderRadius: 2, color: 'text.disabled',
      }}>
        <Typography variant="body2">Ajoutez des étapes depuis la palette à gauche</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto' }}>
      {steps.map((step, idx) => (
        <Box
          key={step.id}
          draggable={!readOnly}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={() => { setDraggingIdx(null); setOverIdx(null); }}
          sx={{
            opacity: draggingIdx === idx ? 0.4 : 1,
            outline: overIdx === idx && draggingIdx !== idx ? '2px dashed #1976d2' : 'none',
            borderRadius: 2,
            transition: 'opacity 0.15s',
          }}
        >
          <StepConfigPanel
            step={step}
            expanded={expandedId === step.id}
            onToggle={() => toggleExpand(step.id)}
            onChange={(patch) => updateStep(step.id, patch)}
            onDelete={() => deleteStep(step.id)}
            creditTypes={creditTypes}
            readOnly={readOnly}
          />
        </Box>
      ))}
    </Box>
  );
}
