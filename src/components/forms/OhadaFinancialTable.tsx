import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, IconButton,
  Button, Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  incomeStatement, cashflowStatement, balanceSheet,
  OhadaSection, OhadaRow, OhadaStatement,
} from './ohadaStatements';

interface OhadaFinancialTableProps {
  year: number;
  onComplete: (data: {
    incomeStatement: Record<string, number>;
    cashFlow: Record<string, number>;
    balance: { brut: Record<string, number>; amort: Record<string, number> };
  }) => void;
}

// ─── Moteur de calcul ─────────────────────────────────────────────────────────

function computeValues(
  statement: OhadaStatement,
  inputValues: Record<string, number>,
): Record<string, number> {
  const all: Record<string, number> = { ...inputValues };
  for (const section of statement.sections) {
    for (const row of section.rows) {
      if ((row.type === 'calculated' || row.type === 'total') && row.formula && row.signs) {
        all[row.code] = row.formula.reduce((sum, code, i) => {
          const val = all[code] ?? 0;
          return sum + (row.signs![i] === '+' ? val : -val);
        }, 0);
      }
    }
  }
  return all;
}

function fmt(val: number | undefined): string {
  if (val === undefined || val === 0) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(val);
}

// ─── Composant TableauOnglet (Compte de Résultat & Flux) ──────────────────────

interface StatementTabProps {
  statement: OhadaStatement;
  values: Record<string, number>;
  computed: Record<string, number>;
  openSections: Record<string, boolean>;
  onChange: (code: string, val: number) => void;
  onToggleSection: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

function StatementTab({
  statement, values, computed, openSections,
  onChange, onToggleSection, onExpandAll, onCollapseAll,
}: StatementTabProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<ExpandAllIcon />} onClick={onExpandAll} variant="outlined" sx={{ fontSize: 11 }}>
          Tout déplier
        </Button>
        <Button size="small" startIcon={<CollapseAllIcon />} onClick={onCollapseAll} variant="outlined" sx={{ fontSize: 11 }}>
          Tout plier
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ width: 70, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: '#64748b' }}>Libellé</TableCell>
              <TableCell align="right" sx={{ width: 200, fontWeight: 700, fontSize: 11, color: '#64748b' }}>
                Montant (FCFA)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {statement.sections.map((section) => (
              <SectionRows
                key={section.id}
                section={section}
                isOpen={openSections[section.id] ?? section.defaultOpen}
                values={values}
                computed={computed}
                onChange={onChange}
                onToggle={() => onToggleSection(section.id)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Lignes d'une section ─────────────────────────────────────────────────────

interface SectionRowsProps {
  section: OhadaSection;
  isOpen: boolean;
  values: Record<string, number>;
  computed: Record<string, number>;
  onChange: (code: string, val: number) => void;
  onToggle: () => void;
}

function SectionRows({ section, isOpen, values, computed, onChange, onToggle }: SectionRowsProps) {
  return (
    <>
      <TableRow
        onClick={onToggle}
        sx={{
          bgcolor: section.headerColor,
          cursor: 'pointer',
          '&:hover': { opacity: 0.9 },
        }}
      >
        <TableCell colSpan={2} sx={{ py: 1, px: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" sx={{ color: 'white', p: 0 }}>
              {isOpen ? <CollapseIcon sx={{ fontSize: 18 }} /> : <ExpandIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 12 }}>
              {section.title}
            </Typography>
          </Box>
        </TableCell>
        <TableCell />
      </TableRow>

      {section.rows.map((row) => {
        if (row.type === 'input' && !isOpen) return null;
        return <DataRow key={row.code} row={row} values={values} computed={computed} onChange={onChange} />;
      })}
    </>
  );
}

// ─── Ligne individuelle ───────────────────────────────────────────────────────

interface DataRowProps {
  row: OhadaRow;
  values: Record<string, number>;
  computed: Record<string, number>;
  onChange: (code: string, val: number) => void;
}

function DataRow({ row, values, computed, onChange }: DataRowProps) {
  const rowBg =
    row.type === 'total' ? '#1565c0' :
    row.type === 'calculated' ? '#fffde7' :
    'white';
  const textColor = row.type === 'total' ? 'white' : '#1e293b';

  return (
    <TableRow sx={{ bgcolor: rowBg, '&:hover': { bgcolor: row.type === 'input' ? '#f8fafc' : rowBg } }}>
      <TableCell sx={{ py: 0.75, px: 1.5, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
        {row.code}
      </TableCell>
      <TableCell sx={{ py: 0.75, pl: 1.5 + row.indent * 2, pr: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: row.bold ? 700 : 400, color: textColor }}>
          {row.label}
        </Typography>
      </TableCell>
      <TableCell align="right" sx={{ py: 0.5, px: 1.5, width: 200 }}>
        {row.type === 'input' ? (
          <TextField
            size="small"
            type="number"
            value={values[row.code] ?? ''}
            onChange={(e) => onChange(row.code, parseFloat(e.target.value) || 0)}
            inputProps={{ style: { textAlign: 'right', fontSize: 12, padding: '4px 8px' } }}
            sx={{ width: 160, '& .MuiOutlinedInput-root': { height: 28 } }}
          />
        ) : (
          <Typography sx={{
            fontSize: 12, fontWeight: 700,
            color: row.type === 'total' ? 'white' : (computed[row.code] ?? 0) < 0 ? '#c62828' : '#1565c0',
          }}>
            {fmt(computed[row.code])}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Onglet Bilan (3 colonnes) ────────────────────────────────────────────────

interface BalanceTabProps {
  brut: Record<string, number>;
  amort: Record<string, number>;
  computed: Record<string, number>;
  openSections: Record<string, boolean>;
  onChangeBrut: (code: string, val: number) => void;
  onChangeAmort: (code: string, val: number) => void;
  onToggleSection: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

function BalanceTab({
  brut, amort, computed, openSections,
  onChangeBrut, onChangeAmort, onToggleSection, onExpandAll, onCollapseAll,
}: BalanceTabProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, justifyContent: 'flex-end' }}>
        <Button size="small" startIcon={<ExpandAllIcon />} onClick={onExpandAll} variant="outlined" sx={{ fontSize: 11 }}>
          Tout déplier
        </Button>
        <Button size="small" startIcon={<CollapseAllIcon />} onClick={onCollapseAll} variant="outlined" sx={{ fontSize: 11 }}>
          Tout plier
        </Button>
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ width: 70, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: '#64748b' }}>Libellé</TableCell>
              <TableCell align="right" sx={{ width: 160, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Brut</TableCell>
              <TableCell align="right" sx={{ width: 160, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Amort./Dépréc.</TableCell>
              <TableCell align="right" sx={{ width: 160, fontWeight: 700, fontSize: 11, color: '#64748b' }}>Net</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {balanceSheet.sections.map((section) => {
              const isOpen = openSections[section.id] ?? section.defaultOpen;
              return (
                <React.Fragment key={section.id}>
                  <TableRow onClick={() => onToggleSection(section.id)} sx={{ bgcolor: section.headerColor, cursor: 'pointer', '&:hover': { opacity: 0.9 } }}>
                    <TableCell colSpan={4} sx={{ py: 1, px: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton size="small" sx={{ color: 'white', p: 0 }}>
                          {isOpen ? <CollapseIcon sx={{ fontSize: 18 }} /> : <ExpandIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                        <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 12 }}>{section.title}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  {section.rows.map((row) => {
                    if (row.type === 'input' && !isOpen) return null;
                    const net = (brut[row.code] ?? 0) - (amort[row.code] ?? 0);
                    const computedNet = (row.type === 'calculated' || row.type === 'total') ? (computed[row.code] ?? 0) : net;
                    const rowBg = row.type === 'total' ? '#1565c0' : row.type === 'calculated' ? '#fffde7' : 'white';
                    const textColor = row.type === 'total' ? 'white' : '#1e293b';
                    return (
                      <TableRow key={row.code} sx={{ bgcolor: rowBg }}>
                        <TableCell sx={{ py: 0.75, px: 1.5, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{row.code}</TableCell>
                        <TableCell sx={{ py: 0.75, pl: 1.5 + row.indent * 2, pr: 1 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: row.bold ? 700 : 400, color: textColor }}>{row.label}</Typography>
                        </TableCell>
                        {row.type === 'input' ? (
                          <>
                            <TableCell align="right" sx={{ py: 0.5, px: 1 }}>
                              <TextField size="small" type="number" value={brut[row.code] ?? ''} onChange={(e) => onChangeBrut(row.code, parseFloat(e.target.value) || 0)} inputProps={{ style: { textAlign: 'right', fontSize: 12, padding: '4px 6px' } }} sx={{ width: 130, '& .MuiOutlinedInput-root': { height: 28 } }} />
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.5, px: 1 }}>
                              <TextField size="small" type="number" value={amort[row.code] ?? ''} onChange={(e) => onChangeAmort(row.code, parseFloat(e.target.value) || 0)} inputProps={{ style: { textAlign: 'right', fontSize: 12, padding: '4px 6px' } }} sx={{ width: 130, '& .MuiOutlinedInput-root': { height: 28 } }} />
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.75, px: 1.5 }}>
                              <Typography sx={{ fontSize: 12, fontWeight: 600, color: net < 0 ? '#c62828' : '#1565c0' }}>{fmt(net)}</Typography>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell /><TableCell />
                            <TableCell align="right" sx={{ py: 0.75, px: 1.5 }}>
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: row.type === 'total' ? 'white' : computedNet < 0 ? '#c62828' : '#1565c0' }}>{fmt(computedNet)}</Typography>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function OhadaFinancialTable({ year, onComplete }: OhadaFinancialTableProps) {
  const [activeTab, setActiveTab] = useState(0);

  const [incomeValues, setIncomeValues] = useState<Record<string, number>>({});
  const [cashflowValues, setCashflowValues] = useState<Record<string, number>>({});
  const [balanceBrut, setBalanceBrut] = useState<Record<string, number>>({});
  const [balanceAmort, setBalanceAmort] = useState<Record<string, number>>({});

  const [incomeOpen, setIncomeOpen] = useState<Record<string, boolean>>({});
  const [cashflowOpen, setCashflowOpen] = useState<Record<string, boolean>>({});
  const [balanceOpen, setBalanceOpen] = useState<Record<string, boolean>>({});

  const incomeComputed = useMemo(() => computeValues(incomeStatement, incomeValues), [incomeValues]);
  const cashflowComputed = useMemo(() => computeValues(cashflowStatement, cashflowValues), [cashflowValues]);

  const balanceNetValues = useMemo(() => {
    const net: Record<string, number> = {};
    balanceSheet.sections.forEach((s) => s.rows.forEach((r) => {
      if (r.type === 'input') net[r.code] = (balanceBrut[r.code] ?? 0) - (balanceAmort[r.code] ?? 0);
    }));
    return net;
  }, [balanceBrut, balanceAmort]);

  const balanceComputed = useMemo(() => computeValues(balanceSheet, balanceNetValues), [balanceNetValues]);

  const handleIncomeChange = useCallback((code: string, val: number) =>
    setIncomeValues((p) => ({ ...p, [code]: val })), []);
  const handleCashflowChange = useCallback((code: string, val: number) =>
    setCashflowValues((p) => ({ ...p, [code]: val })), []);
  const handleBalanceBrutChange = useCallback((code: string, val: number) =>
    setBalanceBrut((p) => ({ ...p, [code]: val })), []);
  const handleBalanceAmortChange = useCallback((code: string, val: number) =>
    setBalanceAmort((p) => ({ ...p, [code]: val })), []);

  const makeExpandAll = (stmt: OhadaStatement, setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => () =>
    setter(Object.fromEntries(stmt.sections.map((s) => [s.id, true])));
  const makeCollapseAll = (stmt: OhadaStatement, setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => () =>
    setter(Object.fromEntries(stmt.sections.map((s) => [s.id, false])));
  const makeToggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => (id: string) =>
    setter((p) => ({ ...p, [id]: !(p[id] ?? true) }));

  const handleSave = () => {
    onComplete({
      incomeStatement: incomeComputed,
      cashFlow: cashflowComputed,
      balance: { brut: balanceBrut, amort: balanceAmort },
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
          États Financiers SYSCOHADA — Exercice {year}
        </Typography>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} size="small">
          Enregistrer
        </Button>
      </Box>

      <Box sx={{ borderBottom: '1px solid #e2e8f0', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ '& .MuiTab-root': { fontWeight: 600, fontSize: 13 } }}>
          <Tab label="Compte de Résultat" />
          <Tab label="Flux de Trésorerie" />
          <Tab label="Bilan" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <StatementTab
          statement={incomeStatement}
          values={incomeValues}
          computed={incomeComputed}
          openSections={incomeOpen}
          onChange={handleIncomeChange}
          onToggleSection={makeToggle(setIncomeOpen)}
          onExpandAll={makeExpandAll(incomeStatement, setIncomeOpen)}
          onCollapseAll={makeCollapseAll(incomeStatement, setIncomeOpen)}
        />
      )}
      {activeTab === 1 && (
        <StatementTab
          statement={cashflowStatement}
          values={cashflowValues}
          computed={cashflowComputed}
          openSections={cashflowOpen}
          onChange={handleCashflowChange}
          onToggleSection={makeToggle(setCashflowOpen)}
          onExpandAll={makeExpandAll(cashflowStatement, setCashflowOpen)}
          onCollapseAll={makeCollapseAll(cashflowStatement, setCashflowOpen)}
        />
      )}
      {activeTab === 2 && (
        <BalanceTab
          brut={balanceBrut}
          amort={balanceAmort}
          computed={balanceComputed}
          openSections={balanceOpen}
          onChangeBrut={handleBalanceBrutChange}
          onChangeAmort={handleBalanceAmortChange}
          onToggleSection={makeToggle(setBalanceOpen)}
          onExpandAll={makeExpandAll(balanceSheet, setBalanceOpen)}
          onCollapseAll={makeCollapseAll(balanceSheet, setBalanceOpen)}
        />
      )}
    </Box>
  );
}
