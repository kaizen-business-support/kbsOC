import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { PolicyStep, CreditType } from '../../types/creditPolicyBuilder';
import { StepConfigPanel } from './StepConfigPanel';

interface Props {
  steps: PolicyStep[];
  onStepsChange: (steps: PolicyStep[]) => void;
  creditTypes: CreditType[];
  roles?: { value: string; label: string }[];
  readOnly?: boolean;
  selectedStepId?: string | null;
  onSelectStep?: (id: string) => void;
}

export function StepList({ steps, onStepsChange, creditTypes, roles, readOnly = false, selectedStepId, onSelectStep }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Sync external selectedStepId → expand that step
  useEffect(() => {
    if (selectedStepId) setExpandedId(selectedStepId);
  }, [selectedStepId]);

  const toggleExpand = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next && onSelectStep) onSelectStep(next);
  };

  const updateStep = (id: string, patch: Partial<PolicyStep>) =>
    onStepsChange(steps.map((s) => s.id === id ? { ...s, ...patch } : s));

  const deleteStep = (id: string) => {
    const target = steps.find((s) => s.id === id);
    if (target?.stepType === 'CREATION') return;
    const filtered = steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
    onStepsChange(filtered);
    if (expandedId === id) setExpandedId(null);
  };

  const handleDragStart = (idx: number) => setDraggingIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx); };
  const handleDrop = (toIdx: number) => {
    if (draggingIdx === null || draggingIdx === toIdx) { setDraggingIdx(null); setOverIdx(null); return; }
    if (steps[draggingIdx]?.stepType === 'CREATION') { setDraggingIdx(null); setOverIdx(null); return; }
    if (toIdx === 0 && steps[0]?.stepType === 'CREATION') { setDraggingIdx(null); setOverIdx(null); return; }
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
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        p: 3, gap: 2, minHeight: 200,
      }}>
        <PlaylistAddIcon sx={{ fontSize: 48, color: '#cbd5e1' }} />
        <Typography sx={{ color: '#94a3b8', textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
          Aucune étape configurée
        </Typography>
        <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2, p: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: '#64748b', lineHeight: 1.8 }}>
            <strong>Comment ajouter des étapes :</strong><br />
            1. Cliquez sur un type dans le panel <strong>Éléments</strong> à gauche<br />
            2. L'étape apparaît ici et dans le schéma<br />
            3. Cliquez sur l'étape pour la configurer<br />
            4. Glissez les étapes pour les réordonner<br />
            5. Cliquez <strong>Enregistrer</strong> pour sauvegarder
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1 }}>
      {steps.map((step, idx) => (
        <Box
          key={step.id}
          draggable={!readOnly && step.stepType !== 'CREATION'}
          onDragStart={() => step.stepType !== 'CREATION' && handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={() => handleDrop(idx)}
          onDragEnd={() => { setDraggingIdx(null); setOverIdx(null); }}
          sx={{
            opacity: draggingIdx === idx ? 0.35 : 1,
            outline: overIdx === idx && draggingIdx !== idx ? '2px dashed #1976d2' : 'none',
            borderRadius: 2,
            transition: 'opacity 0.15s',
          }}
        >
          <StepConfigPanel
            step={step}
            index={idx}
            expanded={expandedId === step.id}
            onToggle={() => toggleExpand(step.id)}
            onChange={(patch) => updateStep(step.id, patch)}
            onDelete={() => deleteStep(step.id)}
            creditTypes={creditTypes}
            roles={roles}
            readOnly={readOnly}
          />
        </Box>
      ))}
    </Box>
  );
}
