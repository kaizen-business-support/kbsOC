import React, { useState } from 'react';
import {
  CircularProgress, IconButton, ListItemIcon,
  Menu, MenuItem, Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
} from '@mui/icons-material';
import { Dashboard, DashboardWidget, Period } from '../../types';
import { ApiService } from '../../services/api';
import { exportToPDF, exportToExcel } from '../../services/exportService';

interface ExportMenuProps {
  dashboard: Dashboard;
  widgets: DashboardWidget[];
  globalPeriod: Period;
  gridRef: React.RefObject<HTMLDivElement>;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  dashboard, widgets, globalPeriod, gridRef,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const slug = slugify(dashboard.name);
  const date = new Date().toISOString().slice(0, 10);

  const handleExportPDF = async () => {
    setAnchorEl(null);
    if (!gridRef.current) return;
    setExportingPdf(true);
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    try {
      await exportToPDF(gridRef.current, `dashboard-${slug}-${date}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setAnchorEl(null);
    if (widgets.length === 0) return;
    setExportingExcel(true);
    try {
      const results = await Promise.all(
        widgets.map(w => {
          const cfg = w.config as any;
          return ApiService.getWidgetData({
            source: cfg.source ?? 'applications',
            metric: cfg.metric ?? 'count',
            period: cfg.periodOverride ?? globalPeriod,
            ...(cfg.groupBy && { groupBy: cfg.groupBy }),
            ...(cfg.filter && { filter: cfg.filter }),
            limit: 500,
          });
        })
      );
      const sheets = widgets.map((w, i) => {
        const res = results[i];
        const rows: Record<string, any>[] = [];
        if (res.success && res.data) {
          const d = res.data;
          if (d.rows) {
            rows.push(...d.rows);
          } else if (d.series) {
            rows.push(...d.series.map((s: any) => ({ Nom: s.name, Valeur: s.value })));
          } else if (d.value !== undefined) {
            rows.push({ Métrique: w.title, Valeur: d.value, Tendance: d.trend ?? '' });
          }
        }
        return { name: w.title || `Widget ${i + 1}`, rows };
      });
      exportToExcel(sheets, `dashboard-${slug}-${date}.xlsx`);
    } finally {
      setExportingExcel(false);
    }
  };

  const busy = exportingPdf || exportingExcel;

  return (
    <>
      <Tooltip title="Exporter">
        <span>
          <IconButton size="small" onClick={e => setAnchorEl(e.currentTarget)} disabled={busy}>
            {busy ? <CircularProgress size={18} /> : <DownloadIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={handleExportPDF} disabled={exportingPdf}>
          <ListItemIcon><PdfIcon fontSize="small" /></ListItemIcon>
          Exporter en PDF
        </MenuItem>
        <MenuItem onClick={handleExportExcel} disabled={exportingExcel}>
          <ListItemIcon><ExcelIcon fontSize="small" /></ListItemIcon>
          Exporter les données (Excel)
        </MenuItem>
      </Menu>
    </>
  );
};
