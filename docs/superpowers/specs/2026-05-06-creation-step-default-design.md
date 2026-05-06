# Étape "Création" obligatoire par défaut dans les politiques de crédit

**Date** : 2026-05-06  
**Statut** : Approuvé

## Contexte

Toute politique de crédit doit obligatoirement commencer par une étape "Création" (stepType `CREATION`). Cette étape représente le point de départ du circuit : la création du dossier par le Chargé d'Affaires. Actuellement, rien n'empêche de créer une politique sans cette étape, ni de la supprimer après coup.

## Objectif

- Injecter automatiquement l'étape "Création" en position 1 lors de la création de toute nouvelle politique de crédit.
- Rendre cette étape non supprimable (frontend + backend).
- Laisser les autres champs (rôle, durée, etc.) éditables à la discrétion de la banque.

## Approche retenue : Garantie frontend + backend

Protection à deux niveaux pour un SaaS bancaire : le backend est la source de vérité, le frontend offre une UX cohérente.

---

## Design Backend

### Constante partagée — Étape "Création" par défaut

Dans `backend/src/routes/credit-policy.ts`, définir une constante locale réutilisée par POST et PUT :

```ts
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
```

### Helper de normalisation des étapes

```ts
function normalizeStepsWithCreation(clientSteps: any[]): any[] {
  // Filtrer toute étape CREATION envoyée par le client (évite les doublons)
  const nonCreation = clientSteps.filter((s) => s.stepType !== 'CREATION');
  return [
    DEFAULT_CREATION_STEP,
    ...nonCreation.map((s, idx) => ({
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

### 1. Création de politique (`POST /api/credit-policies`)

Remplacer le bloc `steps` dans `prisma.creditPolicy.create` :

```ts
const allSteps = normalizeStepsWithCreation(Array.isArray(steps) ? steps : []);

const policy = await prisma.creditPolicy.create({
  data: {
    name, code, description,
    isActive: false,
    validFrom: validFrom ? new Date(validFrom) : new Date(),
    validTo: validTo ? new Date(validTo) : null,
    companyId: req.companyId,
    steps: { create: allSteps },
  },
  include: { steps: { orderBy: { order: 'asc' } } },
});
```

### 2. Mise à jour de politique (`PUT /api/credit-policies/:id`)

Dans le bloc `if (Array.isArray(steps))` (lignes 275–301), remplacer la construction du tableau `data` passé à `createMany` par un appel à `normalizeStepsWithCreation` :

```ts
if (Array.isArray(steps)) {
  await prisma.creditPolicyStep.deleteMany({ where: { policyId: req.params.id } });
  const allSteps = normalizeStepsWithCreation(steps);
  if (allSteps.length > 0) {
    await prisma.creditPolicyStep.createMany({
      data: allSteps.map((s) => ({ ...s, policyId: req.params.id })),
    });
  }
}
```

### 3. Protection contre la suppression (`DELETE /api/credit-policies/:id/steps/:stepId`)

Avant d'exécuter le `prisma.creditPolicyStep.delete` (ligne 503) :

```ts
const step = await prisma.creditPolicyStep.findUnique({ where: { id: req.params.stepId } });
if (!step) return res.status(404).json({ success: false, error: 'Étape introuvable' });
if (step.stepType === 'CREATION') {
  return res.status(403).json({
    success: false,
    error: "L'étape Création est obligatoire et ne peut pas être supprimée",
  });
}
await prisma.creditPolicyStep.delete({ where: { id: req.params.stepId } });
```

### 4. Ajout d'une étape individuelle (`POST /api/credit-policies/:id/steps`)

Bloquer l'ajout d'une étape de type `CREATION` (déjà présente) :

```ts
if (stepType === 'CREATION') {
  return res.status(403).json({
    success: false,
    error: "L'étape Création est unique et ne peut pas être ajoutée manuellement",
  });
}
```

### 5. Modification d'une étape individuelle (`PUT /api/credit-policies/:id/steps/:stepId`)

Avant la mise à jour, récupérer l'étape existante et appliquer deux gardes :

```ts
const existing = await prisma.creditPolicyStep.findUnique({ where: { id: req.params.stepId } });
if (!existing) return res.status(404).json({ success: false, error: 'Étape introuvable' });

// Empêcher de changer le stepType de l'étape CREATION
if (existing.stepType === 'CREATION' && stepType !== undefined && stepType !== 'CREATION') {
  return res.status(403).json({
    success: false,
    error: "Le type de l'étape Création ne peut pas être modifié",
  });
}

// Empêcher de déplacer l'étape CREATION hors de la position 1
if (existing.stepType === 'CREATION' && order !== undefined && order !== 1) {
  return res.status(403).json({
    success: false,
    error: "L'étape Création doit rester en position 1",
  });
}

// Ensuite, exécuter le prisma.creditPolicyStep.update existant
```

---

## Design Frontend

### 1. `handleNewPolicy` (`WorkflowPolicyBuilder.tsx` — ligne 200)

Le backend retourne la politique avec ses étapes dans `res.data`. Utiliser ces étapes directement plutôt que d'appeler `loadData()` puis de vider les steps :

```ts
const handleNewPolicy = async () => {
  const name = `Politique ${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const res = await creditPolicyApi.createPolicy({ name, code: `POL-${Date.now()}`, description: '' });
  if (res.success && res.data) {
    await loadData();
    setSelectedPolicyId(res.data.id);
    setSteps(res.data.steps ?? []);  // ← remplace setSteps([])
    setCurrentVersion(res.data.version ?? 1);
  }
};
```

`setSteps(res.data.steps ?? [])` garantit que les étapes affichées correspondent à ce que le backend a créé (incluant l'étape "Création"), indépendamment de la politique sélectionnée par `loadData()`.

### 2. `StepConfigPanel.tsx` — Masquer le bouton supprimer sur l'étape "Création"

Le bouton `DeleteIcon` se trouve aux lignes 84–94. Conditionner son affichage sur `step.stepType !== 'CREATION'` :

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

### 3. `StepConfigPanel.tsx` — Sélecteur "Type d'étape" sur l'étape "Création"

Le Select liste actuellement `['DISPATCH', 'ANALYSIS', 'APPROVAL', 'COMMITTEE', 'LEGAL']` (ligne 122), sans `CREATION`. Pour l'étape "Création", désactiver le Select afin d'éviter l'affichage d'un type vide ou incohérent :

```tsx
<Select
  value={step.stepType}
  label="Type d'étape"
  disabled={readOnly || step.stepType === 'CREATION'}
  onChange={(e) => onChange({ stepType: e.target.value as any })}
>
```

### 4. `StepList.tsx` — Guard dans `deleteStep`

Même si le bouton est masqué dans `StepConfigPanel`, ajouter une garde défensive dans `deleteStep` de `StepList.tsx` :

```ts
const deleteStep = (id: string) => {
  const target = steps.find((s) => s.id === id);
  if (target?.stepType === 'CREATION') return; // défense en profondeur
  const filtered = steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
  onStepsChange(filtered);
  if (expandedId === id) setExpandedId(null);
};
```

### 5. `StepList.tsx` — Bloquer le drag-and-drop de l'étape "Création"

**a) Attribut `draggable` dans le JSX** : l'étape CREATION ne doit jamais être draggable.

```tsx
<Box
  draggable={!readOnly && step.stepType !== 'CREATION'}
  onDragStart={() => step.stepType !== 'CREATION' && handleDragStart(idx)}
  onDragOver={(e) => handleDragOver(e, idx)}
  onDrop={() => handleDrop(idx)}
  // ...
>
```

**b) Guard dans `handleDrop`** : annuler si la source est CREATION ou si le drop déplacerait une autre étape en position 0.

```ts
const handleDrop = (toIdx: number) => {
  if (draggingIdx === null || draggingIdx === toIdx) { setDraggingIdx(null); setOverIdx(null); return; }
  if (steps[draggingIdx]?.stepType === 'CREATION') { setDraggingIdx(null); setOverIdx(null); return; }
  if (toIdx === 0 && steps[0]?.stepType === 'CREATION') { setDraggingIdx(null); setOverIdx(null); return; }
  // ... reste de la logique existante
};
```

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `backend/src/routes/credit-policy.ts` | Constante + helper `normalizeStepsWithCreation` ; POST + PUT policy + DELETE + POST/:id/steps + PUT/:id/steps/:stepId protégés |
| `src/components/workflow-builder/WorkflowPolicyBuilder.tsx` | `handleNewPolicy` : `setSteps(res.data.steps ?? [])` au lieu de `setSteps([])` |
| `src/components/workflow-builder/StepConfigPanel.tsx` | Masquer DeleteIcon + désactiver Select type sur stepType CREATION |
| `src/components/workflow-builder/StepList.tsx` | Guard dans `deleteStep` + `draggable={false}` + guard dans `handleDrop` sur stepType CREATION |

---

## Cas limites couverts

| Cas | Traitement |
|---|---|
| Client envoie une étape CREATION dans req.body.steps (POST/PUT) | Filtrée par `normalizeStepsWithCreation` — pas de doublon |
| DELETE direct sur l'étape CREATION via l'API | Bloqué HTTP 403 |
| POST /:id/steps avec stepType CREATION | Bloqué HTTP 403 |
| PUT avec tableau steps sans étape CREATION | `normalizeStepsWithCreation` la réinjecte |
| Drag de l'étape CREATION | Bloqué via `draggable=false` + guard handleDrop |
| Drop en position 0 (déplacement de CREATION) | Bloqué par guard handleDrop |
| PUT /:id/steps/:stepId changeant stepType/order de CREATION | Bloqué HTTP 403 |
| `onDelete` appelé sans clic bouton (clavier, test) | Guard dans `deleteStep` de StepList.tsx |
| Sélecteur "Type d'étape" sur CREATION | Select désactivé — pas de valeur vide |

---

## Hors scope

- Migration des politiques existantes sans étape "Création".
- Verrouillage du `stepName` ou `stepLabel` de l'étape "Création" en lecture seule.
