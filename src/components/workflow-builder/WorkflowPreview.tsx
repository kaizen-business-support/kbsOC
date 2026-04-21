import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PolicyStep, STEP_TYPE_CONFIG } from '../../types/creditPolicyBuilder';

interface Props {
  steps: PolicyStep[];
}

export function WorkflowPreview({ steps }: Props) {
  const { nodes, edges } = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.order - b.order);

    const nodes: Node[] = sorted.map((step, i) => ({
      id: step.id,
      position: { x: 160, y: i * 120 },
      data: {
        label: (
          <Box sx={{ textAlign: 'center', p: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: STEP_TYPE_CONFIG[step.stepType].color, display: 'block' }}>
              {STEP_TYPE_CONFIG[step.stepType].label}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              {step.stepLabel || '(sans nom)'}
            </Typography>
          </Box>
        ),
      },
      style: {
        background: STEP_TYPE_CONFIG[step.stepType].bgColor,
        border: `2px solid ${STEP_TYPE_CONFIG[step.stepType].color}`,
        borderRadius: 8,
        width: 180,
        fontSize: 12,
      },
    }));

    const edges: Edge[] = sorted.slice(0, -1).map((step, i) => ({
      id: `e-${step.id}-${sorted[i + 1].id}`,
      source: step.id,
      target: sorted[i + 1].id,
      animated: false,
      style: { stroke: '#90a4ae', strokeWidth: 2 },
    }));

    return { nodes, edges };
  }, [steps]);

  if (steps.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
        <Typography variant="body2">Ajoutez des étapes pour voir l'aperçu</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, height: '100%', minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Box>
  );
}
