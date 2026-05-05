import React, { useMemo, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  ReactFlow, Background, Controls,
  type Node, type Edge, MarkerType, type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PolicyStep, STEP_TYPE_CONFIG } from '../../types/creditPolicyBuilder';

interface Props {
  steps: PolicyStep[];
  selectedStepId?: string | null;
  onSelectStep?: (id: string) => void;
}

const NODE_W = 160;
const NODE_H = 82;
const H_GAP = 50;
const ROW_Y = 24;
const CIRCLE_SIZE = 54;

function formatRole(role: string) {
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const edgeBase = { stroke: '#90a4ae', strokeWidth: 2 };
const marker = { type: MarkerType.ArrowClosed, color: '#90a4ae', width: 16, height: 16 };

const circleStyle = (bg: string, border: string, selected: boolean): React.CSSProperties => ({
  background: bg,
  color: '#fff',
  borderRadius: '50%',
  width: CIRCLE_SIZE,
  height: CIRCLE_SIZE,
  fontSize: 11,
  fontWeight: 700,
  border: `3px solid ${selected ? '#1976d2' : border}`,
  boxShadow: selected ? '0 0 0 3px #1976d240' : 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center' as const,
  padding: 0,
  lineHeight: 1.3,
});

export function WorkflowPreview({ steps, selectedStepId, onSelectStep }: Props) {
  const { nodes, edges, summary } = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.order - b.order);
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const circleY = ROW_Y + NODE_H / 2 - CIRCLE_SIZE / 2;

    nodes.push({
      id: '__start__',
      position: { x: 16, y: circleY },
      data: { label: '▶\nDébut' },
      style: circleStyle('#2e7d32', '#66bb6a', false),
      selectable: false,
    });

    let x = 16 + CIRCLE_SIZE + H_GAP;

    sorted.forEach((step, i) => {
      const cfg = STEP_TYPE_CONFIG[step.stepType];
      const isSelected = step.id === selectedStepId;
      const guardCount = step.guards?.conditions?.length ?? 0;

      nodes.push({
        id: step.id,
        position: { x, y: ROW_Y },
        data: {
          label: (
            <Box sx={{ p: '6px 10px', width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.4,
                bgcolor: cfg.color, color: '#fff',
                borderRadius: '6px', px: 0.8, py: 0.15,
                fontSize: 9, fontWeight: 700, mb: 0.5,
              }}>
                {cfg.label}
              </Box>
              <Typography sx={{ display: 'block', fontWeight: 700, fontSize: 12, lineHeight: 1.2, color: '#111' }}>
                {i + 1}. {step.stepLabel || '(sans nom)'}
              </Typography>
              <Typography sx={{ display: 'block', fontSize: 10, color: '#555', mt: 0.4 }}>
                👤 {formatRole(step.assignedRole)}
              </Typography>
              {guardCount > 0 && (
                <Typography sx={{ display: 'block', fontSize: 9, color: cfg.color, fontWeight: 600, mt: 0.3 }}>
                  🛡 {guardCount} garde{guardCount > 1 ? 's' : ''}
                </Typography>
              )}
            </Box>
          ),
        },
        style: {
          background: isSelected ? '#fff' : cfg.bgColor,
          border: `2px solid ${isSelected ? '#1976d2' : cfg.color}`,
          boxShadow: isSelected ? '0 0 0 3px #1976d230, 0 4px 12px rgba(25,118,210,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
          borderRadius: 10,
          width: NODE_W,
          minHeight: NODE_H,
          padding: 0,
          cursor: 'pointer',
          transition: 'all 0.15s',
        },
      });

      x += NODE_W + H_GAP;
    });

    nodes.push({
      id: '__end__',
      position: { x, y: circleY },
      data: { label: '⏹\nFin' },
      style: circleStyle('#b71c1c', '#ef5350', false),
      selectable: false,
    });

    if (sorted.length === 0) {
      edges.push({ id: 'e-s-e', source: '__start__', target: '__end__', markerEnd: marker, style: edgeBase });
    } else {
      edges.push({ id: 'e-start', source: '__start__', target: sorted[0].id, markerEnd: marker, style: edgeBase });
      sorted.forEach((step, i) => {
        const next = sorted[i + 1];
        edges.push({
          id: `e-${i}`,
          source: step.id,
          target: next ? next.id : '__end__',
          markerEnd: marker,
          style: edgeBase,
        });
      });
    }

    const uniqueRoles = new Set(sorted.map((s) => s.assignedRole)).size;
    const guardsCount = sorted.filter((s) => (s.guards?.conditions?.length ?? 0) > 0).length;

    return {
      nodes, edges,
      summary: {
        stepCount: sorted.length,
        roleCount: uniqueRoles,
        guardsCount,
        hasSteps: sorted.length > 0,
        allAssigned: sorted.every((s) => !!s.assignedRole),
        allLabeled: sorted.every((s) => !!s.stepLabel?.trim()),
      },
    };
  }, [steps, selectedStepId]);

  const handleNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.id !== '__start__' && node.id !== '__end__' && onSelectStep) {
      onSelectStep(node.id);
    }
  }, [onSelectStep]);

  if (steps.length === 0) {
    return (
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'text.disabled', gap: 1, bgcolor: '#f8f9fa',
      }}>
        <Typography variant="body2" sx={{ color: '#bdbdbd' }}>
          Glissez des étapes depuis la palette pour construire votre workflow
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          onNodeClick={handleNodeClick}
          style={{ background: '#ffffff' }}
        >
          <Background color="#e2e8f0" gap={24} size={1} variant={'dots' as any} />
          <Controls showInteractive={false} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }} />
        </ReactFlow>
      </Box>

      {/* Résumé */}
      <Box sx={{
        borderTop: '1px solid', borderColor: 'divider',
        px: 2, py: 1.5, bgcolor: '#fafafa', flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#9e9e9e', letterSpacing: 0.6 }}>
            Résumé du workflow
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 3, mb: 1.5 }}>
          {[
            { v: summary.stepCount, l: 'Étapes',  c: '#1565c0' },
            { v: summary.roleCount, l: 'Rôles',   c: '#2e7d32' },
            { v: summary.guardsCount, l: 'Gardes', c: '#6a1b9a' },
          ].map(({ v, l, c }) => (
            <Box key={l} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 22, color: c, lineHeight: 1 }}>{v}</Typography>
              <Typography sx={{ fontSize: 10, color: '#9e9e9e' }}>{l}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
          {[
            { ok: summary.hasSteps, label: 'Au moins une étape définie' },
            { ok: summary.allAssigned, label: 'Tous les rôles assignés' },
            { ok: summary.allLabeled, label: 'Toutes les étapes nommées' },
          ].map(({ ok, label }) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {ok
                ? <CheckCircleIcon sx={{ fontSize: 13, color: '#2e7d32' }} />
                : <CancelIcon sx={{ fontSize: 13, color: '#e53935' }} />}
              <Typography sx={{ fontSize: 11, color: ok ? '#388e3c' : '#e53935' }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
