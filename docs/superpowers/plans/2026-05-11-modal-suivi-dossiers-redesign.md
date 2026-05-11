# Modal Suivi des Dossiers — Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `WorkflowDetailsDialog.tsx` de 6 onglets en 3 (Vue d'ensemble · Financier · Documents) avec une timeline acteurs enrichie et un onglet Financier visuellement renforcé.

**Architecture:** Modification chirurgicale de sections JSX dans `WorkflowDetailsDialog.tsx` sans toucher à la logique métier (hooks, API calls, OTP, canApprove). `WorkflowTimeline.tsx` est supprimé : la timeline est réécrite inline. Ajout d'un seul nouvel état (`selectedYears`) pour le filtre d'années dans l'onglet Financier.

**Tech Stack:** React 18, MUI v5, TypeScript — `react-scripts build` pour vérification de type.

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `src/components/WorkflowDetailsDialog.tsx` | Modifier — imports, état, JSX (tabs + 3 TabPanels) |
| `src/components/WorkflowTimeline.tsx` | Supprimer |

---

## Task 1 — Mettre à jour les imports MUI icons + ajouter l'état `selectedYears`

**Files:**
- Modify: `src/components/WorkflowDetailsDialog.tsx:32-44` (imports icônes)
- Modify: `src/components/WorkflowDetailsDialog.tsx:85-96` (états du composant)
- Modify: `src/components/WorkflowDetailsDialog.tsx:222-230` (useEffect reset)
- Modify: `src/components/WorkflowDetailsDialog.tsx:369-371` (après calcul `years`/`latestYear`)

- [ ] **Step 1.1 — Remplacer le bloc d'import icônes**

Remplacer (lignes 32-44) :
```tsx
import {
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  BarChart as BarChartIcon,
  Star as StarIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  FolderOpen as FolderIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon
} from '@mui/icons-material';
```

Par :
```tsx
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  CheckCircle as ApproveIcon,
  CheckCircleOutline as StepDoneIcon,
  Schedule as ScheduleIcon,
  Cancel as RejectIcon,
  FolderOpen as FolderIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  CloudUpload as CloudUploadIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Image as ImageIcon,
  TableChart as TableChartIcon,
  Person as PersonIcon,
  CreditScore as CreditScoreIcon,
  WaterDrop as WaterDropIcon,
  Balance as BalanceIcon,
  Autorenew as AutorenewIcon,
} from '@mui/icons-material';
```

- [ ] **Step 1.2 — Ajouter l'état `selectedYears`**

Après la ligne `const [previewError, setPreviewError] = useState<string | null>(null);` (≈ligne 107), ajouter :
```tsx
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
```

- [ ] **Step 1.3 — Réinitialiser `selectedYears` à l'ouverture du dialog**

Dans le `useEffect` qui reset (≈lignes 222-230), ajouter `setSelectedYears([]);` :
```tsx
  useEffect(() => {
    if (open) {
      setActiveTab(0);
      setDocuments([]);
      setComments('');
      setSubmitError(null);
      setSubmitSuccess(null);
      setSelectedYears([]);
    }
  }, [open, workflow?.applicationId]);
```

- [ ] **Step 1.4 — Corriger l'index de l'onglet Documents dans le useEffect de fetch**

Remplacer (≈ligne 233) :
```tsx
  useEffect(() => {
    if (activeTab === 5 && workflow?.applicationId) {
      fetchDocuments(workflow.applicationId);
    }
  }, [activeTab, workflow?.applicationId, fetchDocuments]);
```

Par :
```tsx
  useEffect(() => {
    if (activeTab === 2 && workflow?.applicationId) {
      fetchDocuments(workflow.applicationId);
    }
  }, [activeTab, workflow?.applicationId, fetchDocuments]);
```

- [ ] **Step 1.5 — Ajouter `filteredYearsData` et `toggleYear` après le calcul de `latestYearData`**

Après la ligne `const latestYearData = latestYear ? resolveYearData(financialData[latestYear]) : null;` (≈ligne 441), ajouter :
```tsx
  const filteredYearsData = allYearsData.filter(({ year }) =>
    selectedYears.length === 0 ? true : selectedYears.includes(year)
  );

  const toggleYear = (year: number) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.length > 1 ? prev.filter(y => y !== year) : prev;
      }
      return [...prev, year].sort((a, b) => a - b);
    });
  };
```

- [ ] **Step 1.6 — Vérifier la compilation**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npm run build 2>&1 | tail -20
```
Résultat attendu : aucune erreur TypeScript (warnings d'unused vars possibles, ignorés pour l'instant).

- [ ] **Step 1.7 — Commit**

```bash
git add src/components/WorkflowDetailsDialog.tsx
git commit -m "refactor(modal): update imports + selectedYears state + fix docs tab index"
```

---

## Task 2 — Remplacer la barre d'onglets (6 → 3)

**Files:**
- Modify: `src/components/WorkflowDetailsDialog.tsx:589-614` (barre Tabs)

- [ ] **Step 2.1 — Remplacer le bloc `<Box sx={{ borderBottom... }}>...<Tabs>...</Tabs></Box>`**

Remplacer (lignes 589-614) :
```tsx
      <Box sx={{ borderBottom: '1px solid rgba(0,0,0,0.07)', px: 2, bgcolor: '#fafafa' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40, fontSize: '12px', fontWeight: 500,
              px: 1.5, minWidth: 0, gap: 0.5, color: '#8e8e93',
              textTransform: 'none', letterSpacing: 0,
            },
            '& .Mui-selected': { color: '#1c1c1e', fontWeight: 650 },
            '& .MuiTabs-indicator': { height: 2, borderRadius: '2px 2px 0 0' },
          }}
        >
          <Tab label="Workflow"    icon={<AssessmentIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Demande"     icon={<TrendingUpIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Financier"   icon={<TrendingUpIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Ratios"      icon={<BarChartIcon  sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Scoring"     icon={<StarIcon       sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Documents"   icon={<FolderIcon     sx={{ fontSize: 13 }} />} iconPosition="start" />
        </Tabs>
      </Box>
```

Par :
```tsx
      <Box sx={{ borderBottom: '1px solid rgba(0,0,0,0.07)', px: 2, bgcolor: '#fafafa' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40, fontSize: '12px', fontWeight: 500,
              px: 2, minWidth: 0, gap: 0.5, color: '#8e8e93',
              textTransform: 'none', letterSpacing: 0,
            },
            '& .Mui-selected': { color: '#1c1c1e', fontWeight: 650 },
            '& .MuiTabs-indicator': { height: 2, borderRadius: '2px 2px 0 0' },
          }}
        >
          <Tab label="Vue d'ensemble" icon={<PersonIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Financier"      icon={<AccountBalanceIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
          <Tab label="Documents"      icon={<FolderIcon sx={{ fontSize: 13 }} />} iconPosition="start" />
        </Tabs>
      </Box>
```

- [ ] **Step 2.2 — Vérifier la compilation**

```bash
npm run build 2>&1 | grep -E "ERROR|error TS" | head -10
```
Résultat attendu : aucune erreur.

- [ ] **Step 2.3 — Commit**

```bash
git add src/components/WorkflowDetailsDialog.tsx
git commit -m "refactor(modal): réduire à 3 onglets (Vue d'ensemble, Financier, Documents)"
```

---

## Task 3 — Implémenter l'onglet 0 : Vue d'ensemble

**Files:**
- Modify: `src/components/WorkflowDetailsDialog.tsx:617-906` (TabPanels 0 et 1 → nouveau Tab 0)

- [ ] **Step 3.1 — Remplacer les TabPanels 0 et 1 par le nouveau TabPanel 0**

Remplacer depuis `{/* Tab 0: Workflow Timeline */}` jusqu'à la fin du `</TabPanel>` de l'ancien Tab 1 (lignes 617-906) par :

```tsx
        {/* Tab 0: Vue d'ensemble */}
        <TabPanel value={activeTab} index={0}>
          {/* ─── Section Demande ─────────────────────────────────────────── */}
          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 1 }}>
            Demande
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0.5, mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <PersonIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Informations Client</Typography>
                  </Box>
                  <Divider sx={{ mb: 1.5 }} />
                  {[
                    { label: 'Nom du client', value: workflow.clientName },
                    { label: 'Chargé de compte', value: application?.accountManager || application?.creator?.name || '—' },
                    { label: 'Secteur', value: application?.sector || application?.client?.sector || '—' },
                    { label: 'Agence', value: application?.branch || workflow.steps?.[0]?.branch || '—' },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', maxWidth: '55%' }}>{value}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <CreditScoreIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Détails de la Demande</Typography>
                  </Box>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ mb: 1 }}>
                    {new Intl.NumberFormat('fr-FR').format(workflow.requestedAmount)} {workflow.currency || 'XOF'}
                  </Typography>
                  {[
                    { label: 'Type de crédit', value: application?.creditType?.name || application?.creditTypeName || '—' },
                    { label: 'Durée', value: application?.duration ? `${application.duration} mois` : '—' },
                    { label: 'Objet', value: application?.purpose || '—' },
                    { label: 'Soumis le', value: workflow.totalStartedAt ? new Date(workflow.totalStartedAt).toLocaleDateString('fr-FR') : '—' },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', maxWidth: '55%' }}>{value}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ─── Section Parcours du dossier ─────────────────────────────── */}
          <Divider sx={{ mb: 2 }}>
            <Chip
              label={`Parcours du dossier · ${workflow.steps?.length || 0} étape${(workflow.steps?.length || 0) > 1 ? 's' : ''}`}
              size="small"
              sx={{ fontWeight: 600, fontSize: '11px' }}
            />
          </Divider>

          {workflow.steps && workflow.steps.length > 0 ? (
            <Box sx={{ pl: 1 }}>
              {workflow.steps.map((step, idx) => {
                const isCompleted = !!step.completedAt;
                const isActive = !step.completedAt && !!step.startedAt;
                const isLast = idx === (workflow.steps?.length ?? 0) - 1;

                const formatStepDate = (ts: string) =>
                  new Date(ts).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  });

                const formatStepDuration = (ms?: number) => {
                  if (!ms) return null;
                  const totalH = Math.floor(ms / 3600000);
                  const d = Math.floor(totalH / 24);
                  const h = totalH % 24;
                  return d > 0 ? `${d}j ${h}h` : `${totalH}h`;
                };

                const decisionColor: 'success' | 'error' | 'warning' | 'default' =
                  step.decision === 'approved' ? 'success' :
                  step.decision === 'rejected' ? 'error' :
                  step.decision === 'on_hold' ? 'warning' : 'default';

                const decisionLabel =
                  step.decision === 'approved' ? 'Approuvé' :
                  step.decision === 'rejected' ? 'Refusé' :
                  step.decision === 'on_hold' ? 'En attente' :
                  isActive ? 'En cours' : null;

                const nextStep = isActive && !isLast ? workflow.steps?.[idx + 1] : null;

                return (
                  <Box
                    key={step.stepId}
                    sx={{ display: 'flex', gap: 1.5, opacity: (!isCompleted && !isActive) ? 0.4 : 1 }}
                  >
                    {/* Rail */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                      <Box sx={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: '1px',
                        bgcolor: isCompleted ? 'success.main' : isActive ? 'primary.main' : 'grey.300',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isCompleted && <StepDoneIcon sx={{ fontSize: 14, color: 'white' }} />}
                        {isActive && <ScheduleIcon sx={{ fontSize: 14, color: 'white' }} />}
                      </Box>
                      {!isLast && (
                        <Box sx={{ width: 2, flex: 1, minHeight: 28, bgcolor: 'grey.200', mt: '2px' }} />
                      )}
                    </Box>

                    {/* Contenu */}
                    <Box sx={{ pb: 2.5, flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.4 }}>
                        <Typography variant="body2" fontWeight={700}>{step.stepName}</Typography>
                        {decisionLabel && (
                          <Chip
                            label={decisionLabel}
                            color={decisionColor}
                            size="small"
                            sx={{ height: 18, fontSize: '10px', fontWeight: 600 }}
                          />
                        )}
                      </Box>

                      {step.userName && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                          <Avatar sx={{ width: 18, height: 18, fontSize: 9, bgcolor: '#e3f2fd', color: 'primary.main' }}>
                            {step.userName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="caption" color="text.secondary">
                            {step.userName}{step.userRole ? ` · ${step.userRole}` : ''}
                          </Typography>
                        </Box>
                      )}

                      {step.startedAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {formatStepDate(step.startedAt)}
                          {step.duration ? ` · ⏱ ${formatStepDuration(step.duration)}` : ''}
                        </Typography>
                      )}

                      {step.comments && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.25 }}>
                          "{step.comments}"
                        </Typography>
                      )}

                      {nextStep && (
                        <Box sx={{
                          mt: 0.75, px: 1.25, py: 0.5, bgcolor: '#e3f2fd',
                          borderRadius: 1, display: 'inline-block',
                        }}>
                          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                            → Prochaine étape : {nextStep.stepName}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Aucune étape disponible pour ce dossier.
            </Typography>
          )}
        </TabPanel>
```

- [ ] **Step 3.2 — Vérifier la compilation**

```bash
npm run build 2>&1 | grep -E "ERROR|error TS" | head -15
```
Résultat attendu : 0 erreur.

- [ ] **Step 3.3 — Commit**

```bash
git add src/components/WorkflowDetailsDialog.tsx
git commit -m "feat(modal): implémenter onglet Vue d'ensemble (Demande + timeline acteurs)"
```

---

## Task 4 — Implémenter l'onglet 1 : Financier

**Files:**
- Modify: `src/components/WorkflowDetailsDialog.tsx` — remplacer TabPanels 2, 3 et 4 (anciennes lignes 908-2277, maintenant décalées) par le nouveau Tab 1

- [ ] **Step 4.1 — Localiser le nouveau début de TabPanel 2**

```bash
grep -n "Tab 2: Financial Data Summary\|Tab 3: Ratios\|Tab 4: Scoring" src/components/WorkflowDetailsDialog.tsx
```
Noter les numéros de ligne actuels (décalés après Task 3).

- [ ] **Step 4.2 — Remplacer les 3 TabPanels (Financier + Ratios + Scoring) par le nouveau Tab 1**

Remplacer depuis `{/* Tab 2: Financial Data Summary */}` jusqu'au `</TabPanel>` de la fin du Tab 4 Scoring par :

```tsx
        {/* Tab 1: Financier */}
        <TabPanel value={activeTab} index={1}>
          {/* Sélecteur d'années */}
          {years.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
              {years.map(year => (
                <Chip
                  key={year}
                  label={year}
                  size="small"
                  variant={selectedYears.length === 0 || selectedYears.includes(year) ? 'filled' : 'outlined'}
                  onClick={() => toggleYear(year)}
                  color={selectedYears.length === 0 || selectedYears.includes(year) ? 'primary' : 'default'}
                  sx={{ cursor: 'pointer', fontWeight: 600, fontSize: '11px' }}
                />
              ))}
            </Box>
          )}

          {allYearsData.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

              {/* ─── Bloc 1 : Grandes Masses du Bilan ───────────────────── */}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <AccountBalanceIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Grandes Masses du Bilan (SYSCOHADA)</Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'rgba(25,118,210,0.06)' }}>
                          <TableCell sx={{ fontWeight: 700, py: 0.75 }}>Poste</TableCell>
                          <TableCell sx={{ fontWeight: 700, py: 0.75, width: 80 }}>Cat.</TableCell>
                          {filteredYearsData.map(({ year }) => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 700, py: 0.75 }}>{year}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          { label: 'Actif Immobilisé', field: 'actif_immobilise', cat: 'ACTIF', catColor: 'rgba(25,118,210,0.1)', catText: '#1565c0' },
                          { label: 'Actif Circulant',  field: 'actif_circulant',  cat: 'ACTIF', catColor: 'rgba(25,118,210,0.1)', catText: '#1565c0' },
                          { label: 'Trésorerie Actif', field: 'tresorerie',       cat: 'ACTIF', catColor: 'rgba(25,118,210,0.1)', catText: '#1565c0' },
                        ].map(({ label, field, cat, catColor, catText }) => (
                          <TableRow key={label} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                            <TableCell sx={{ py: 0.5 }}>{label}</TableCell>
                            <TableCell sx={{ py: 0.5 }}>
                              <Chip label={cat} size="small" sx={{ height: 16, fontSize: '9px', fontWeight: 700, bgcolor: catColor, color: catText }} />
                            </TableCell>
                            {filteredYearsData.map(({ year, data }) => (
                              <TableCell key={year} align="right" sx={{ py: 0.5 }}>{formatCurrency(getNumericValue(data, field))}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: 'rgba(25,118,210,0.08)' }}>
                          <TableCell sx={{ fontWeight: 700, py: 0.75 }}>TOTAL ACTIF</TableCell>
                          <TableCell />
                          {filteredYearsData.map(({ year, data }) => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 700, py: 0.75 }}>
                              {formatCurrency(computeBalanceTotals(data).totalActif)}
                            </TableCell>
                          ))}
                        </TableRow>
                        {[
                          { label: 'Capitaux Propres',   field: 'capitaux_propres',  cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                          { label: 'Dettes Financières', field: 'dettes_financieres', cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                          { label: 'Passif Circulant',   field: 'passif_circulant',  cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                          { label: 'Trésorerie Passif',  field: 'tresorerie_passif', cat: 'PASSIF', catColor: 'rgba(76,175,80,0.12)', catText: '#2e7d32' },
                        ].map(({ label, field, cat, catColor, catText }) => (
                          <TableRow key={label} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                            <TableCell sx={{ py: 0.5 }}>{label}</TableCell>
                            <TableCell sx={{ py: 0.5 }}>
                              <Chip label={cat} size="small" sx={{ height: 16, fontSize: '9px', fontWeight: 700, bgcolor: catColor, color: catText }} />
                            </TableCell>
                            {filteredYearsData.map(({ year, data }) => (
                              <TableCell key={year} align="right" sx={{ py: 0.5 }}>{formatCurrency(getNumericValue(data, field))}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: 'rgba(76,175,80,0.08)' }}>
                          <TableCell sx={{ fontWeight: 700, py: 0.75 }}>TOTAL PASSIF</TableCell>
                          <TableCell />
                          {filteredYearsData.map(({ year, data }) => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 700, py: 0.75 }}>
                              {formatCurrency(computeBalanceTotals(data).totalPassif)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* ─── Bloc 2 : Compte de Résultat ──────────────────────── */}
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <TrendingUpIcon sx={{ color: 'success.main', fontSize: 18 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Compte de Résultat</Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                          <TableCell sx={{ fontWeight: 700, py: 0.75 }}>Indicateur</TableCell>
                          {filteredYearsData.map(({ year }) => (
                            <TableCell key={year} align="right" sx={{ fontWeight: 700, py: 0.75 }}>{year}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          { label: "Chiffre d'Affaires", field: 'chiffre_affaires' },
                          { label: 'Valeur Ajoutée',     field: 'valeur_ajoutee' },
                          { label: 'EBE',                field: 'ebe' },
                          { label: 'Résultat Exploitation', field: 'resultat_exploitation' },
                          { label: 'Résultat Net',       field: 'resultat_net' },
                        ].map(({ label, field }) => (
                          <TableRow key={label} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                            <TableCell sx={{ py: 0.5 }}>{label}</TableCell>
                            {filteredYearsData.map(({ year, data }, i) => {
                              const val = getNumericValue(data, field);
                              const prevData = i > 0 ? filteredYearsData[i - 1].data : null;
                              const prevVal = prevData ? getNumericValue(prevData, field) : null;
                              const trend = prevVal !== null && prevVal !== 0
                                ? val > prevVal ? 'up' : val < prevVal ? 'down' : null
                                : null;
                              return (
                                <TableCell key={year} align="right" sx={{ py: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.4 }}>
                                    <span>{formatCurrency(val)}</span>
                                    {trend === 'up' && <TrendingUpIcon sx={{ fontSize: 13, color: 'success.main' }} />}
                                    {trend === 'down' && <TrendingDownIcon sx={{ fontSize: 13, color: 'error.main' }} />}
                                  </Box>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* ─── Bloc 3 : Ratios clés ─────────────────────────────── */}
              <Box>
                <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 1, display: 'block', mb: 1 }}>
                  Ratios Clés (dernière année)
                </Typography>
                <Grid container spacing={1.5}>
                  {(() => {
                    const r = calculateRatios(latestYearData);
                    const cards = [
                      {
                        label: 'Liquidité Générale', value: r?.currentRatio ?? 'N/A', unit: 'x',
                        norm: '≥ 1.5', ok: parseFloat(r?.currentRatio || '0') >= 1.5,
                        icon: <WaterDropIcon sx={{ fontSize: 16 }} />, color: '#1976d2',
                      },
                      {
                        label: 'Marge Nette', value: r?.netMargin ?? 'N/A', unit: '%',
                        norm: '≥ 10 %', ok: parseFloat(r?.netMargin || '0') >= 10,
                        icon: <TrendingUpIcon sx={{ fontSize: 16 }} />, color: '#388e3c',
                      },
                      {
                        label: 'Dette / Capitaux', value: r?.debtToEquity ?? 'N/A', unit: 'x',
                        norm: '≤ 1.0', ok: parseFloat(r?.debtToEquity || '99') <= 1,
                        icon: <BalanceIcon sx={{ fontSize: 16 }} />, color: '#f57c00',
                      },
                      {
                        label: 'Rotation Actif', value: r?.assetTurnover ?? 'N/A', unit: 'x',
                        norm: '≥ 1.0', ok: parseFloat(r?.assetTurnover || '0') >= 1,
                        icon: <AutorenewIcon sx={{ fontSize: 16 }} />, color: '#7b1fa2',
                      },
                    ];
                    return cards.map(card => (
                      <Grid item xs={6} md={3} key={card.label}>
                        <Card variant="outlined" sx={{
                          borderRadius: 2,
                          borderLeft: '3px solid',
                          borderLeftColor: card.value === 'N/A' ? 'grey.400' : card.ok ? 'success.main' : 'error.main',
                        }}>
                          <CardContent sx={{ p: 1.5, pb: '12px !important' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: card.color, mb: 0.5 }}>
                              {card.icon}
                              <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.2 }}>{card.label}</Typography>
                            </Box>
                            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>
                              {card.value === 'N/A' ? '—' : `${card.value}${card.unit}`}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">{card.norm}</Typography>
                              {card.value !== 'N/A' && (
                                <Chip
                                  label={card.ok ? 'OK' : 'Attention'}
                                  size="small"
                                  color={card.ok ? 'success' : 'warning'}
                                  sx={{ height: 16, fontSize: '9px', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ));
                  })()}
                </Grid>
              </Box>

              {/* ─── Bloc 4 : Scoring ─────────────────────────────────── */}
              {overallScore > 0 && (
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
                        <Typography
                          variant="h2"
                          fontWeight={800}
                          sx={{
                            lineHeight: 1,
                            color: getProgressColor(overallScore) === 'success' ? '#2e7d32' :
                                   getProgressColor(overallScore) === 'warning' ? '#e65100' : '#c62828',
                          }}
                        >
                          {overallScore}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">/100</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700}>Score Global</Typography>
                          <Chip
                            label={getRiskLevel(overallScore).label}
                            color={getRiskLevel(overallScore).color}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={overallScore}
                          color={getProgressColor(overallScore)}
                          sx={{ height: 10, borderRadius: 5, bgcolor: 'grey.200', mb: 0.75 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Financier : {financialScore} · Analyste : {analystScore}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}

            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Aucune donnée financière disponible pour ce dossier.
            </Typography>
          )}
        </TabPanel>
```

- [ ] **Step 4.2 — Vérifier la compilation**

```bash
npm run build 2>&1 | grep -E "ERROR|error TS" | head -15
```
Résultat attendu : 0 erreur.

- [ ] **Step 4.3 — Commit**

```bash
git add src/components/WorkflowDetailsDialog.tsx
git commit -m "feat(modal): implémenter onglet Financier (bilan + CR + ratios + scoring)"
```

---

## Task 5 — Implémenter l'onglet 2 : Documents (redesign)

**Files:**
- Modify: `src/components/WorkflowDetailsDialog.tsx` — remplacer l'ancien TabPanel 5 (Documents) par le nouveau Tab 2

- [ ] **Step 5.1 — Localiser l'ancien TabPanel Documents**

```bash
grep -n "Tab 5: Documents\|Tab 2: Documents" src/components/WorkflowDetailsDialog.tsx
```
Noter la ligne de début.

- [ ] **Step 5.2 — Remplacer le TabPanel Documents par le nouveau Tab 2**

Remplacer depuis `{/* Tab 5: Documents */}` jusqu'à son `</TabPanel>` fermant par :

```tsx
        {/* Tab 2: Documents */}
        <TabPanel value={activeTab} index={2}>
          {/* Zone d'upload */}
          <Box
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: 'grey.300',
              borderRadius: 2,
              bgcolor: 'grey.50',
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              mb: 2,
              transition: 'border-color 0.15s, background-color 0.15s',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(25,118,210,0.04)' },
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => uploadDocuments(e.target.files)}
            />
            {docsUploading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">Téléversement en cours…</Typography>
              </Box>
            ) : (
              <>
                <CloudUploadIcon sx={{ fontSize: 32, color: 'grey.400', mb: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                  Glissez vos fichiers ici ou{' '}
                  <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>cliquez pour parcourir</Box>
                </Typography>
              </>
            )}
          </Box>

          {docsUploadError && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setDocsUploadError(null)}>
              {docsUploadError}
            </Alert>
          )}

          {/* Liste des documents */}
          {docsLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : documents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <FolderIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Aucun document attaché à ce dossier.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {documents.map((doc: any) => {
                const ext = (doc.filename as string)?.split('.').pop()?.toLowerCase();
                const isPdf  = ext === 'pdf';
                const isImg  = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '');
                const isSheet = ['xlsx', 'xls', 'csv'].includes(ext || '');
                const IconComp = isPdf ? PictureAsPdfIcon : isImg ? ImageIcon : isSheet ? TableChartIcon : FileIcon;
                const iconColor = isPdf ? '#f44336' : isImg ? '#9c27b0' : isSheet ? '#4caf50' : '#1976d2';
                return (
                  <Box
                    key={doc.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 1.5, py: 1, borderRadius: 1.5,
                      border: '1px solid', borderColor: 'grey.100',
                      transition: 'all 0.1s',
                      '&:hover': { bgcolor: 'grey.50', borderColor: 'grey.200' },
                    }}
                  >
                    <IconComp sx={{ fontSize: 26, color: iconColor, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{doc.filename}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.size ? `${Math.round(doc.size / 1024)} Ko · ` : ''}
                        {doc.uploadedByName || doc.uploadedBy || ''}
                        {doc.createdAt
                          ? ` · ${new Date(doc.createdAt).toLocaleDateString('fr-FR')}`
                          : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      <Tooltip title="Aperçu">
                        <IconButton size="small" onClick={() => openPreview(doc)} sx={{ color: 'grey.600' }}>
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Télécharger">
                        <IconButton size="small" onClick={() => downloadDoc(doc)} sx={{ color: 'grey.600' }}>
                          <DownloadIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Dialog de prévisualisation (secondaire) */}
          {previewDoc && (
            <Dialog open maxWidth="md" fullWidth onClose={closePreview}>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 2 }}>
                <Typography variant="subtitle2" noWrap sx={{ maxWidth: '80%' }}>{previewDoc.filename}</Typography>
                <IconButton
                  size="small"
                  onClick={closePreview}
                  sx={{ bgcolor: 'rgba(0,0,0,0.06)', '&:hover': { bgcolor: 'rgba(0,0,0,0.12)' } }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </DialogTitle>
              <DialogContent sx={{ p: 0, bgcolor: '#1c1c1e', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {previewLoading && <CircularProgress sx={{ color: 'white' }} />}
                {previewError && <Alert severity="error" sx={{ m: 2 }}>{previewError}</Alert>}
                {previewBlobUrl && !previewLoading && (() => {
                  const ext2 = (previewDoc.filename as string)?.split('.').pop()?.toLowerCase();
                  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext2 || '')) {
                    return (
                      <img
                        src={previewBlobUrl}
                        alt={previewDoc.filename}
                        style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                      />
                    );
                  }
                  return (
                    <iframe
                      src={previewBlobUrl}
                      title={previewDoc.filename}
                      style={{ width: '100%', height: '70vh', border: 'none' }}
                    />
                  );
                })()}
              </DialogContent>
            </Dialog>
          )}
        </TabPanel>
```

- [ ] **Step 5.2 — Vérifier la compilation**

```bash
npm run build 2>&1 | grep -E "ERROR|error TS" | head -15
```
Résultat attendu : 0 erreur.

- [ ] **Step 5.3 — Commit**

```bash
git add src/components/WorkflowDetailsDialog.tsx
git commit -m "feat(modal): implémenter onglet Documents (upload zone + liste redesignée + preview)"
```

---

## Task 6 — Supprimer WorkflowTimeline.tsx et nettoyer l'import

**Files:**
- Modify: `src/components/WorkflowDetailsDialog.tsx:46` — supprimer l'import WorkflowTimeline
- Delete: `src/components/WorkflowTimeline.tsx`

- [ ] **Step 6.1 — Supprimer l'import WorkflowTimeline dans WorkflowDetailsDialog.tsx**

Supprimer la ligne :
```tsx
import { WorkflowTimeline } from './WorkflowTimeline';
```

- [ ] **Step 6.2 — Supprimer le fichier WorkflowTimeline.tsx**

```bash
rm src/components/WorkflowTimeline.tsx
```

- [ ] **Step 6.3 — Vérifier qu'aucun autre fichier n'importe WorkflowTimeline**

```bash
grep -rn "WorkflowTimeline" src/ --include="*.tsx" --include="*.ts"
```
Résultat attendu : aucune occurrence.

- [ ] **Step 6.4 — Compilation finale propre**

```bash
npm run build 2>&1 | tail -10
```
Résultat attendu : `Compiled successfully.`

- [ ] **Step 6.5 — Commit final**

```bash
git add src/components/WorkflowDetailsDialog.tsx
git rm src/components/WorkflowTimeline.tsx
git commit -m "refactor(modal): supprimer WorkflowTimeline.tsx (logique intégrée inline)"
```

---

## Self-review

**Couverture spec :**
- ✅ 3 onglets (Vue d'ensemble · Financier · Documents) — Tasks 2-5
- ✅ Header sticky inchangé (non modifié, déjà conforme au spec)
- ✅ Vue d'ensemble — Cards Demande (Task 3)
- ✅ Vue d'ensemble — Timeline acteurs avec avatar/nom/rôle, date/durée, décision/commentaire, prochaine étape (Task 3)
- ✅ Financier — sélecteur années (Task 4)
- ✅ Financier — Grandes Masses du Bilan tableau compact (Task 4)
- ✅ Financier — Compte de Résultat avec flèches tendances (Task 4)
- ✅ Financier — Ratios cards bordure colorée + badge OK/Attention (Task 4)
- ✅ Financier — Scoring compact avec barre et badge risque (Task 4)
- ✅ Documents — zone upload drag-click (Task 5)
- ✅ Documents — liste avec icônes par type + hover (Task 5)
- ✅ Documents — preview dialog secondaire (Task 5)
- ✅ DialogActions (approbation OTP) non modifiées — logique conservée
- ✅ Suppression WorkflowTimeline (Task 6)

**Aucun placeholder** dans le plan.

**Cohérence des types :** `filteredYearsData` défini en Task 1, utilisé en Tasks 4-5 ✓. `toggleYear` défini en Task 1, utilisé en Task 4 ✓. `selectedYears` défini en Task 1, réinitialisé dans useEffect Task 1 ✓.
