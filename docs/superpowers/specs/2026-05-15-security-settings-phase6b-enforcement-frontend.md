# Security Settings — Phase 6b Enforcement Frontend

**Date :** 2026-05-15
**Statut :** design validé, prêt pour plan d'implémentation
**Dépend de :** Phase 6a (backend retourne 423 + `allow_read_only` + endpoint `/api/security/time-status` + IP block enrichi de `blockedIp`).

## 1. Contexte & objectif

Côté frontend, traduire les réponses du backend Phase 6a en UX cohérente :
- **IP block (403)** → redirection vers une page publique `/blocked` qui affiche l'IP, message support, aucune retry possible.
- **Time lock (423)** → banner persistant non-dismissible + désactivation des CTAs métier via un hook React + polling 60s pour réactivation automatique.

Aucun changement backend. Aucun changement structurel d'authentification.

## 2. Architecture

```
App
 ├─ Route /blocked (publique, no auth)
 └─ Route /* (protégée)
       └─ AuthProvider
            └─ SecurityLockProvider
                 ├─ LockedBanner (en haut, conditionnel)
                 └─ MainLayout > Routes app
```

`SecurityLockProvider` :
- Au mount : fetch `/api/security/time-status`.
- Polling toutes les 60s tant que l'utilisateur est authentifié.
- Écoute l'event window `security:time-locked` émis par l'axios interceptor sur 423.
- Expose `{ timeLocked, timeLockedMessage, nextOpenAt, refresh }`.

Axios interceptor :
- `403 + error: 'ip_blocked'` → `sessionStorage.setItem('blockedIp', ...)` + `window.location.href = '/blocked'` (skip si déjà sur /blocked).
- `423 + error: 'outside_time_window'` → `window.dispatchEvent(new CustomEvent('security:time-locked', { detail }))`.

Hook `useSecurityLock` :
```typescript
export function useSecurityLock(): {
  disabled: boolean;
  reason: string | null;
  nextOpenAt: Date | null;
};
```

Pages avec CTA métier importants l'utilisent pour `disabled={...}` sur boutons.

## 3. Composants — détails

### 3.1 `SecurityLockContext.tsx`

```typescript
interface SecurityLockState {
  timeLocked: boolean;
  timeLockedMessage: string | null;
  nextOpenAt: Date | null;
  refresh: () => Promise<void>;
}
```

- State initial : `{ timeLocked: false, ... }`.
- `refresh()` : appelle `ApiService.security.timeStatus()`, met à jour le state.
- `useEffect` mount → `refresh()` + `setInterval(refresh, 60000)` cleanup au unmount.
- `useEffect` mount → `window.addEventListener('security:time-locked', handler)` qui hydrate l'état depuis l'event detail sans attendre le poll.
- Pas de polling si pas authentifié (vérifier via `useUser` ou présence du token avant le fetch).

Le provider ignore silencieusement les erreurs de polling (`catch + log warn`) — un échec ne doit pas faire crasher l'app.

### 3.2 `useSecurityLock.ts`

Hook léger qui lit le context et retourne la forme normalisée pour les consommateurs :
```typescript
return {
  disabled: state.timeLocked,
  reason: state.timeLocked ? state.timeLockedMessage : null,
  nextOpenAt: state.nextOpenAt,
};
```

Pas de logique supplémentaire. Le code consommateur applique `disabled={disabled}` et optionnellement `title={reason}` pour le hover.

### 3.3 `LockedBanner.tsx`

Banner MUI sticky en haut du layout, palette ambre :

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔒 Accès restreint en dehors des heures autorisées.             │
│    Réouverture : ven 16 mai 09:00 (dans 2h 14min)               │
└─────────────────────────────────────────────────────────────────┘
```

- Non-dismissible (pas de bouton X).
- Countdown calculé à partir de `nextOpenAt` ; refresh toutes les 30s (`setInterval`).
- Si `nextOpenAt` est null → "Pas de fenêtre de réouverture connue dans les 14 prochains jours."
- Affiché uniquement si `timeLocked === true`.

### 3.4 `BlockedPage.tsx`

Page accessible sans auth. **Ne fait aucun appel API.**

Contenu :
- Icône bouclier (Material `ShieldOutlined` ou `BlockOutlined`).
- Titre "Accès refusé".
- Paragraphe : "Votre adresse IP est bloquée pour des raisons de sécurité."
- IP en monospace, lue depuis `sessionStorage.getItem('blockedIp')` ; si absente, afficher "—".
- Message contact : "Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur." (texte hardcodé FR ; configuration future via env var).
- Footer minimal (logo Optimus + version statique).

Styles : palette home, large icon centré, max-width 600px.

### 3.5 Axios interceptor

Ajouté dans `src/services/api.ts`, juste après les autres interceptors existants. Le code complet sera dans le plan.

Pré-requis :
- Ne pas perturber les autres handlers (login, refresh token).
- Skip la redirection si on est déjà sur `/blocked`.
- Si `error?.response` est undefined (network error), laisser passer normalement.

### 3.6 Routes (App.tsx)

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/blocked" element={<BlockedPage />} />
    <Route path="/*" element={
      <AuthProvider>
        <SecurityLockProvider>
          <LockedBanner />
          <MainLayout>{/* routes existantes */}</MainLayout>
        </SecurityLockProvider>
      </AuthProvider>
    } />
  </Routes>
</BrowserRouter>
```

L'ordre est important : `/blocked` doit matcher avant le pattern catch-all qui force l'auth.

## 4. Application du hook aux CTAs (PR 6b)

| Fichier | CTAs à protéger via `useSecurityLock` |
|---|---|
| `src/components/security/IPRulesTab.tsx` | Bouton "+ Ajouter une règle", icônes Toggle / Edit / Delete |
| `src/components/security/TimeRulesTab.tsx` | Bouton "+ Ajouter une plage", icônes Toggle / Edit / Delete |
| `src/components/security/BlockHistoryTab.tsx` | Boutons Débloquer (par ligne) + "Débloquer tout (N)" |
| `src/pages/ApprovalsPage.tsx` | Boutons Approuver / Rejeter / Demander info |
| `src/pages/CreditApplicationPage.tsx` | Boutons Soumettre / Sauvegarder / Modifier |
| `src/pages/WorkflowPage.tsx` | Boutons de transition de workflow |

Convention : `<Button disabled={disabled} ... title={disabled ? reason ?? '' : undefined}>` ou `<IconButton disabled={...}>`.

L'attribut `title` HTML donne un tooltip natif sans charger MUI Tooltip pour chaque bouton.

Pas dans cette PR : `ClientManagementPage` (filet 423 backend suffit pour l'instant) ; à reprendre en follow-up si besoin de l'UX banner-disabled.

## 5. API client extensions

`src/services/api.ts` — ajout dans `ApiService.security` :
```typescript
timeStatus: async (): Promise<{
  success: boolean;
  data: {
    locked: boolean;
    message: string | null;
    nextOpen: string | null;        // ISO 8601
    allowReadOnly: boolean;
  };
}> => {
  const r = await api.get('/security/time-status');
  return r.data;
}
```

## 6. Sécurité & limites

- **/blocked accessible sans auth** : aucun lien API. L'utilisateur peut y rester indéfiniment sans charger d'autres ressources. Pas de surface d'attaque ajoutée.
- **Polling 60s** : ~1 req/min/user authentifié. Charge serveur acceptable. Pas de polling sur /blocked ni sur la page de login.
- **Race condition** : si une mutation passe avant la mise à jour du context (juste après expiration de fenêtre), elle remontera 423 et l'interceptor mettra à jour le context. La prochaine action sera disabled.
- **Banner countdown** : approximatif (refresh 30s). Acceptable, l'admin peut tolérer ±1 min d'imprécision.
- **Session storage `blockedIp`** : nettoyé à la prochaine connexion réussie (pas critique de purger).

## 7. Tests

Pas de tests automatisés (CRA `react-scripts test` non utilisé dans le projet). Validation par :
- `tsc --noEmit -p .` après chaque modification.
- Smoke manuel post-déploiement :
  1. Créer une time rule applicable, fenêtre fermée à l'instant → banner doit apparaître ≤ 60s.
  2. Cliquer un CTA protégé → bouton désactivé + tooltip.
  3. Re-créer une time rule ouverte → banner disparaît après prochain poll.
  4. Créer une IP rule DENY couvrant l'IP courante → recharger l'app → redirection automatique vers /blocked avec IP affichée.
  5. Désactiver la règle IP DENY (depuis un autre device/IP) → recharger /blocked manuellement → toujours sur /blocked (pas de retry auto, behavior attendu).
  6. Vérifier qu'aucune requête API ne part depuis /blocked (Network tab vide après chargement).

## 8. Hors-périmètre

- Application du hook à toutes les pages (filet 423 backend suffit pour les pages non touchées).
- Page /blocked thématisée par tenant.
- i18n complète des messages.
- Tests E2E.
- Recover-when-unlocked automatique sur la page /blocked (l'utilisateur doit recharger manuellement).
- Notification push/toast au moment du lock (le banner suffit).

## 9. Migration / déploiement

Aucune migration DB. Aucun nouvel env var requis (texte support hardcodé FR). Pas de coordination back/front : 6b peut être déployée après 6a sans gap.
