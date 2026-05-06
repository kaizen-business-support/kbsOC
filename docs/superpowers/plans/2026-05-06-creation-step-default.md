# Étape "Création" obligatoire par défaut — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toute nouvelle politique de crédit contient automatiquement une étape "Création" en position 1, non supprimable via l'UI ou l'API, mais dont le rôle et la durée restent éditables.

**Architecture:** Protection à deux couches — le backend injecte et protège l'étape "Création" sur tous les endpoints concernés ; le frontend masque le bouton supprimer, désactive le sélecteur de type, et bloque le drag-and-drop sur cette étape.

**Tech Stack:** Node.js/Express + Prisma (backend), React + TypeScript + MUI (frontend)

**Spec:** `docs/superpowers/specs/2026-05-06-creation-step-default-design.md`

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `backend/src/routes/credit-policy.ts` | Constante + helper + 5 guards backend |
| `src/components/workflow-builder/WorkflowPolicyBuilder.tsx` | handleNewPolicy utilise res.data.steps |
| `src/components/workflow-builder/StepConfigPanel.tsx` | Bouton supprimer + Select type conditionnels |
| `src/components/workflow-builder/StepList.tsx` | Guard deleteStep + drag-and-drop bloqué |

---

## Tâche 1 — Backend : constante, helper et guards POST/PUT policy

**Fichiers :**
- Modifier : `backend/src/routes/credit-policy.ts`

### Contexte

Le fichier `credit-policy.ts` gère tous les endpoints des politiques de crédit. Il faut :
1. Ajouter une constante `DEFAULT_CREATION_STEP` et un helper `normalizeStepsWithCreation` juste après les imports (ligne ~30, après `router.use(requireCompany)`).
2. Remplacer le bloc `steps` dans `prisma.creditPolicy.create` (POST /, ligne ~64–96) pour utiliser le helper.
3. Remplacer le bloc `createMany` dans `PUT /:id` (lignes ~276–300) pour utiliser le helper.

- [ ] **Étape 1.1 : Ajouter la constante et le helper après la ligne `router.use(requireCompany);`**

Insérer immédiatement après `router.use(requireCompany);` (ligne 30) :

```ts
// ─── Étape Création par défaut ────────────────────────────────────────────────

const DEFAULT_CREATION_STEP = {
  stepName: 'creation',
  stepLabel: 'Création',
  stepType: 'CREATION' as const,
  assignedRole: 'CHARGE_AFFAIRES',
  order: 1,
  isRequired: true,
  expectedDurationHours: 24,
  maxDurationHours: 72,
  conditionMinAmount: null,
  conditionMaxAmount: null,
  approvalMinAmount: null,
  approvalMaxAmount: null,
  creditTypeIds: [],
  allowedActions: [],
  description: null,
  phase: null,
  guards: null,
  isActive: true,
};

function normalizeStepsWithCreation(clientSteps: any[]): any[] {
  const nonCreation = clientSteps.filter((s: any) => s.stepType !== 'CREATION');
  return [
    DEFAULT_CREATION_STEP,
    ...nonCreation.map((s: any, idx: number) => ({
      stepName: s.stepName || `step_${idx + 2}`,
      stepLabel: s.stepLabel,
      order: idx + 2,
      stepType: s.stepType,
      assignedRole: s.assignedRole,
      conditionMinAmount: s.conditionMinAmount ?? null,
      conditionMaxAmount: s.conditionMaxAmount ?? null,
      approvalMinAmount: s.approvalMinAmount ?? null,
      approvalMaxAmount: s.approvalMaxAmount ?? null,
      expectedDurationHours: s.expectedDurationHours ?? 24,
      maxDurationHours: s.maxDurationHours ?? 72,
      isRequired: s.isRequired ?? true,
      isActive: s.isActive ?? true,
      description: s.description ?? null,
      creditTypeIds: s.creditTypeIds ?? [],
      allowedActions: s.allowedActions ?? [],
      phase: s.phase ?? null,
      guards: s.guards ?? null,
    })),
  ];
}
```

- [ ] **Étape 1.2 : Remplacer le bloc `steps` dans `prisma.creditPolicy.create` (POST /)**

Dans le handler `router.post('/')`, remplacer exactement (lignes 73–93) :
```ts
        steps: steps
          ? {
              create: steps.map((s: any, idx: number) => ({
                stepName: s.stepName,
                stepLabel: s.stepLabel,
                order: s.order ?? idx + 1,
                stepType: s.stepType,
                assignedRole: s.assignedRole,
                conditionMinAmount: s.conditionMinAmount ?? null,
                conditionMaxAmount: s.conditionMaxAmount ?? null,
                approvalMinAmount: s.approvalMinAmount ?? null,
                approvalMaxAmount: s.approvalMaxAmount ?? null,
                expectedDurationHours: s.expectedDurationHours ?? 24,
                maxDurationHours: s.maxDurationHours ?? 72,
                isRequired: s.isRequired ?? true,
                description: s.description ?? null,
                creditTypeIds: s.creditTypeIds ?? [],
                allowedActions: s.allowedActions ?? [],
              })),
            }
          : undefined,
```
Par :
```ts
        steps: {
          create: normalizeStepsWithCreation(Array.isArray(steps) ? steps : []),
        },
```

- [ ] **Étape 1.3 : Remplacer le bloc `createMany` dans `PUT /:id`**

Dans le handler `router.put('/:id')`, remplacer exactement (lignes 275–302) :
```ts
    // Remplacement complet des étapes si fourni
    if (Array.isArray(steps)) {
      await prisma.creditPolicyStep.deleteMany({ where: { policyId: req.params.id } });
      if (steps.length > 0) {
        await prisma.creditPolicyStep.createMany({
          data: steps.map((s: any, idx: number) => ({
            policyId: req.params.id,
            stepName: s.stepName || (s.stepLabel ? s.stepLabel.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : null) || `step_${idx + 1}`,
            stepLabel: s.stepLabel,
            order: s.order ?? idx + 1,
            stepType: s.stepType,
            assignedRole: s.assignedRole,
            conditionMinAmount: s.conditionMinAmount ?? null,
            conditionMaxAmount: s.conditionMaxAmount ?? null,
            approvalMinAmount: s.approvalMinAmount ?? null,
            approvalMaxAmount: s.approvalMaxAmount ?? null,
            expectedDurationHours: s.expectedDurationHours ?? 24,
            maxDurationHours: s.maxDurationHours ?? 72,
            isRequired: s.isRequired ?? true,
            isActive: s.isActive ?? true,
            description: s.description ?? null,
            creditTypeIds: s.creditTypeIds ?? [],
            allowedActions: s.allowedActions ?? [],
            phase: s.phase ?? null,
            guards: s.guards ?? null,
          })),
        });
      }
    }
```
Par :
```ts
    // Remplacement complet des étapes si fourni
    if (Array.isArray(steps)) {
      await prisma.creditPolicyStep.deleteMany({ where: { policyId: req.params.id } });
      const allSteps = normalizeStepsWithCreation(steps);
      if (allSteps.length > 0) {
        await prisma.creditPolicyStep.createMany({
          data: allSteps.map((s: any) => ({ ...s, policyId: req.params.id })),
        });
      }
    }
```

- [ ] **Étape 1.4 : Vérifier la compilation TypeScript backend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit 2>&1
```
Attendu : aucune erreur.

- [ ] **Étape 1.5 : Commit**

```bash
git add backend/src/routes/credit-policy.ts
git commit -m "feat(credit-policy): injecter étape Création par défaut à la création et mise à jour de politique"
```

---

## Tâche 2 — Backend : guards DELETE, POST/:id/steps et PUT/:id/steps/:stepId

**Fichiers :**
- Modifier : `backend/src/routes/credit-policy.ts`

### Contexte

Trois endpoints doivent être protégés contre toute manipulation de l'étape CREATION :
- `DELETE /:id/steps/:stepId` — refuser la suppression
- `POST /:id/steps` — refuser l'ajout d'une étape CREATION
- `PUT /:id/steps/:stepId` — refuser le changement de `stepType` ou d'`order` sur une étape CREATION

- [ ] **Étape 2.1 : Protéger le DELETE /:id/steps/:stepId**

Dans le handler `router.delete('/:id/steps/:stepId')`, remplacer :
```ts
await prisma.creditPolicyStep.delete({ where: { id: req.params.stepId } });
```
Par :
```ts
const stepToDelete = await prisma.creditPolicyStep.findUnique({ where: { id: req.params.stepId } });
if (!stepToDelete) return res.status(404).json({ success: false, error: 'Étape introuvable' });
if (stepToDelete.stepType === 'CREATION') {
  return res.status(403).json({
    success: false,
    error: "L'étape Création est obligatoire et ne peut pas être supprimée",
  });
}
await prisma.creditPolicyStep.delete({ where: { id: req.params.stepId } });
```

- [ ] **Étape 2.2 : Protéger le POST /:id/steps**

Dans le handler `router.post('/:id/steps')`, remplacer (lignes 372–377) :
```ts
    if (!stepName || !stepLabel || !stepType || !assignedRole) {
      return res.status(400).json({
        success: false,
        error: 'stepName, stepLabel, stepType et assignedRole sont obligatoires',
      });
    }
```
Par :
```ts
    if (!stepName || !stepLabel || !stepType || !assignedRole) {
      return res.status(400).json({
        success: false,
        error: 'stepName, stepLabel, stepType et assignedRole sont obligatoires',
      });
    }

    if (stepType === 'CREATION') {
      return res.status(403).json({
        success: false,
        error: "L'étape Création est unique et ne peut pas être ajoutée manuellement",
      });
    }
```

- [ ] **Étape 2.3 : Protéger le PUT /:id/steps/:stepId**

Dans le handler `router.put('/:id/steps/:stepId')`, remplacer (lignes 465–466) :
```ts

    const step = await prisma.creditPolicyStep.update({
```
Par :
```ts

    const existing = await prisma.creditPolicyStep.findUnique({ where: { id: req.params.stepId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Étape introuvable' });
    if (existing.stepType === 'CREATION' && stepType !== undefined && stepType !== 'CREATION') {
      return res.status(403).json({
        success: false,
        error: "Le type de l'étape Création ne peut pas être modifié",
      });
    }
    if (existing.stepType === 'CREATION' && order !== undefined && order !== 1) {
      return res.status(403).json({
        success: false,
        error: "L'étape Création doit rester en position 1",
      });
    }

    const step = await prisma.creditPolicyStep.update({
```

- [ ] **Étape 2.4 : Vérifier la compilation TypeScript backend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC/backend && npx tsc --noEmit 2>&1
```
Attendu : aucune erreur.

- [ ] **Étape 2.5 : Commit**

```bash
git add backend/src/routes/credit-policy.ts
git commit -m "feat(credit-policy): bloquer suppression/modification/ajout de l'étape Création via l'API"
```

---

## Tâche 3 — Frontend : WorkflowPolicyBuilder — handleNewPolicy

**Fichiers :**
- Modifier : `src/components/workflow-builder/WorkflowPolicyBuilder.tsx` (ligne ~200–208)

### Contexte

La fonction `handleNewPolicy` crée une nouvelle politique et affiche immédiatement les étapes. Actuellement, elle appelle `setSteps([])` qui efface les étapes — y compris celle retournée par le backend. Il faut utiliser `res.data.steps` à la place.

- [ ] **Étape 3.1 : Modifier handleNewPolicy**

Remplacer (lignes 200–208) :
```ts
const handleNewPolicy = async () => {
  const name = `Politique ${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const res = await creditPolicyApi.createPolicy({ name, code: `POL-${Date.now()}`, description: '' });
  if (res.success && res.data) {
    await loadData();
    setSelectedPolicyId(res.data.id);
    setSteps([]); setCurrentVersion(1);
  }
};
```
Par :
```ts
const handleNewPolicy = async () => {
  const name = `Politique ${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const res = await creditPolicyApi.createPolicy({ name, code: `POL-${Date.now()}`, description: '' });
  if (res.success && res.data) {
    await loadData();
    setSelectedPolicyId(res.data.id);
    setSteps(res.data.steps ?? []);
    setCurrentVersion(res.data.version ?? 1);
  }
};
```

- [ ] **Étape 3.2 : Vérifier la compilation TypeScript frontend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```
Attendu : aucune erreur liée à ce fichier.

- [ ] **Étape 3.3 : Commit**

```bash
git add src/components/workflow-builder/WorkflowPolicyBuilder.tsx
git commit -m "feat(workflow-builder): afficher l'étape Création après création d'une nouvelle politique"
```

---

## Tâche 4 — Frontend : StepConfigPanel — bouton supprimer et sélecteur de type

**Fichiers :**
- Modifier : `src/components/workflow-builder/StepConfigPanel.tsx` (lignes 84–94 et 120–128)

### Contexte

Deux éléments UI doivent être conditionnés sur `step.stepType !== 'CREATION'` :
1. Le bouton `DeleteIcon` (lignes 84–94) : masqué sur l'étape CREATION.
2. Le `Select` "Type d'étape" (ligne 120) : désactivé sur l'étape CREATION pour éviter l'affichage d'une valeur vide (CREATION n'est pas dans la liste des options).

- [ ] **Étape 4.1 : Masquer le bouton supprimer sur l'étape CREATION**

Remplacer (lignes 84–94) :
```tsx
{!readOnly && (
  <Tooltip title="Supprimer">
    <IconButton
      size="small"
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      sx={{ color: '#bdbdbd', '&:hover': { color: '#ef5350' } }}
    >
      <DeleteIcon sx={{ fontSize: 15 }} />
    </IconButton>
  </Tooltip>
)}
```
Par :
```tsx
{!readOnly && step.stepType !== 'CREATION' && (
  <Tooltip title="Supprimer">
    <IconButton
      size="small"
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      sx={{ color: '#bdbdbd', '&:hover': { color: '#ef5350' } }}
    >
      <DeleteIcon sx={{ fontSize: 15 }} />
    </IconButton>
  </Tooltip>
)}
```

- [ ] **Étape 4.2 : Désactiver le sélecteur "Type d'étape" sur l'étape CREATION**

Remplacer (ligne ~120) :
```tsx
<Select value={step.stepType} label="Type d'étape" disabled={readOnly}
  onChange={(e) => onChange({ stepType: e.target.value as any })}>
```
Par :
```tsx
<Select value={step.stepType} label="Type d'étape" disabled={readOnly || step.stepType === 'CREATION'}
  onChange={(e) => onChange({ stepType: e.target.value as any })}>
```

- [ ] **Étape 4.3 : Vérifier la compilation TypeScript frontend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```
Attendu : aucune erreur liée à ce fichier.

- [ ] **Étape 4.4 : Commit**

```bash
git add src/components/workflow-builder/StepConfigPanel.tsx
git commit -m "feat(step-config-panel): protéger l'étape Création contre la suppression et le changement de type"
```

---

## Tâche 5 — Frontend : StepList — guard deleteStep et drag-and-drop

**Fichiers :**
- Modifier : `src/components/workflow-builder/StepList.tsx` (lignes 36–50 et 81–110)

### Contexte

Deux protections à ajouter dans `StepList.tsx` :
1. `deleteStep` (ligne 36) : guard défensif — retourner immédiatement si l'étape est CREATION.
2. JSX du rendu de chaque étape (ligne 84) : `draggable` conditionné + `onDragStart` conditionné.
3. `handleDrop` (ligne 44) : deux guards supplémentaires pour annuler le drop si la source ou la cible impliquerait de déplacer l'étape CREATION.

- [ ] **Étape 5.1 : Ajouter le guard dans deleteStep**

Remplacer (lignes 36–40) :
```ts
const deleteStep = (id: string) => {
  const filtered = steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
  onStepsChange(filtered);
  if (expandedId === id) setExpandedId(null);
};
```
Par :
```ts
const deleteStep = (id: string) => {
  const target = steps.find((s) => s.id === id);
  if (target?.stepType === 'CREATION') return;
  const filtered = steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
  onStepsChange(filtered);
  if (expandedId === id) setExpandedId(null);
};
```

- [ ] **Étape 5.2 : Ajouter les guards dans handleDrop**

Remplacer (lignes 44–52) :
```ts
const handleDrop = (toIdx: number) => {
  if (draggingIdx === null || draggingIdx === toIdx) { setDraggingIdx(null); setOverIdx(null); return; }
  const reordered = [...steps];
  const [moved] = reordered.splice(draggingIdx, 1);
  reordered.splice(toIdx, 0, moved);
  onStepsChange(reordered.map((s, i) => ({ ...s, order: i + 1 })));
  setDraggingIdx(null);
  setOverIdx(null);
};
```
Par :
```ts
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
```

- [ ] **Étape 5.3 : Conditionner draggable et onDragStart dans le JSX**

Remplacer (ligne 84–85) :
```tsx
draggable={!readOnly}
onDragStart={() => handleDragStart(idx)}
```
Par :
```tsx
draggable={!readOnly && step.stepType !== 'CREATION'}
onDragStart={() => step.stepType !== 'CREATION' && handleDragStart(idx)}
```

- [ ] **Étape 5.4 : Vérifier la compilation TypeScript frontend**

```bash
cd /Users/fofana/Bitrix24/kaizen-b/kbsOC && npx tsc --noEmit 2>&1 | head -30
```
Attendu : aucune erreur liée à ce fichier.

- [ ] **Étape 5.5 : Commit**

```bash
git add src/components/workflow-builder/StepList.tsx
git commit -m "feat(step-list): bloquer suppression et drag-and-drop de l'étape Création"
```

---

## Vérification manuelle finale

Après toutes les tâches, tester manuellement dans le navigateur :

1. **Créer une nouvelle politique** — l'étape "Création" doit apparaître automatiquement en position 1.
2. **Tenter de supprimer l'étape "Création"** — le bouton supprimer ne doit pas apparaître.
3. **Tenter de déplacer l'étape "Création"** — le drag doit être impossible.
4. **Vérifier le sélecteur "Type d'étape"** — il doit être grisé sur l'étape "Création".
5. **Modifier le rôle sur l'étape "Création"** — doit fonctionner normalement.
6. **Sauvegarder** — la politique doit être sauvegardée avec l'étape "Création" en position 1.
