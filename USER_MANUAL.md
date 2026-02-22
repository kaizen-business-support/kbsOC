# OptimusCredit v2.0 - Manuel Utilisateur

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Démarrage Rapide](#démarrage-rapide)
3. [Fonctionnalités Principales](#fonctionnalités-principales)
4. [Guide d'Utilisation](#guide-dutilisation)
5. [Gestion des Rôles et Permissions](#gestion-des-rôles-et-permissions)
6. [FAQ](#faq)

---

## Vue d'ensemble

OptimusCredit v2.0 est une plateforme complète d'analyse financière et de gestion de crédit conçue spécifiquement pour les institutions bancaires ouest-africaines. Elle prend en charge les normes comptables SYSCOHADA et la devise XOF.

### Caractéristiques Clés

- ✅ **Processus complet de demande de crédit** avec workflow automatisé
- ✅ **Gestion des clients** avec historique et suivi
- ✅ **Analyse financière avancée** avec scoring automatique
- ✅ **Workflow d'approbation** multi-niveaux configurable
- ✅ **Gestion des utilisateurs** avec contrôle d'accès basé sur les rôles
- ✅ **Tableau de bord analytique** avec KPIs en temps réel
- ✅ **Simulation de crédit** avec tableaux d'amortissement
- ✅ **Support multilingue** (Français/Anglais)

---

## Démarrage Rapide

### Accès à la Plateforme

1. Connectez-vous avec vos identifiants
2. Le tableau de bord principal s'affiche avec les statistiques clés
3. Utilisez le menu latéral pour naviguer entre les modules

### Rôles Disponibles

- **Administrateur** : Accès complet à toutes les fonctionnalités
- **Directeur Général** : Vue d'ensemble et décisions finales
- **Comité de Crédit** : Évaluation des demandes importantes
- **Directeur d'Agence** : Gestion de l'agence et approbations moyennes
- **Analyste Crédit** : Analyse des demandes de crédit
- **Chargé d'Affaires** : Création et suivi des demandes

---

## Fonctionnalités Principales

### 1. Gestion des Clients

#### Créer un Nouveau Client

1. Accédez à **Gestion des Clients** dans le menu
2. Cliquez sur **"Nouveau Client"**
3. Remplissez les informations :
   - **Informations Générales** : Nom, type (Entreprise/Particulier), secteur
   - **Coordonnées** : Adresse, téléphone, email
   - **Informations Financières** : Chiffre d'affaires, situation bancaire
   - **Documents** : NINEA, RCCM, Statuts
4. Validez pour créer le client

#### Rechercher un Client

- Utilisez la barre de recherche pour trouver un client par nom ou NINEA
- Filtrez par secteur d'activité ou statut
- Consultez l'historique complet des demandes

### 2. Demande de Crédit

#### Créer une Nouvelle Demande

1. Accédez à **Nouvelle Demande** dans le menu
2. Sélectionnez ou créez un client
3. Remplissez le formulaire de demande :

##### Étape 1 : Informations de Base
- Montant demandé (XOF)
- Type de crédit (Court terme, Moyen terme, Long terme)
- Durée en mois
- Taux d'intérêt
- Objet du financement

##### Étape 2 : Garanties
- Type de garantie (Hypothèque, Nantissement, Caution)
- Valeur estimée
- Description détaillée
- Documents justificatifs

##### Étape 3 : Documents
- Téléchargez les documents requis :
  - États financiers (3 derniers exercices)
  - Business plan
  - Justificatifs de garanties
  - Autres documents

##### Étape 4 : Analyse Financière
- Saisissez les données financières :
  - Bilan (Actif/Passif)
  - Compte de résultat
  - Flux de trésorerie
- Le système calcule automatiquement les ratios financiers
- Un score de crédit est généré

4. Soumettez la demande pour démarrer le workflow

#### Workflow d'Approbation

Le système route automatiquement la demande selon le montant :

**Montants < 5M XOF :**
1. Analyste Crédit → Analyse et recommandation
2. Directeur d'Agence → Décision finale

**Montants ≥ 5M XOF :**
1. Analyste Crédit → Analyse détaillée
2. Directeur d'Agence → Pré-approbation
3. Comité de Crédit → Évaluation collégiale
4. Direction Générale → Décision finale

### 3. Suivi des Demandes

#### Tableau de Bord Workflow

1. Accédez à **Workflow** dans le menu
2. Visualisez toutes vos demandes en cours
3. Filtrez par statut :
   - En analyse
   - En attente d'approbation
   - Approuvées
   - Refusées

#### Actions Disponibles

- **Consulter** : Voir tous les détails de la demande
- **Analyser** : Ajouter une analyse (Analyste Crédit)
- **Approuver/Refuser** : Prendre une décision (selon rôle)
- **Commenter** : Ajouter des observations
- **Historique** : Voir toutes les étapes du workflow

### 4. Simulation de Crédit

#### Calculer un Crédit

1. Accédez à **Simulation de Crédit**
2. Saisissez les paramètres :
   - Montant du crédit
   - Durée (mois)
   - Taux d'intérêt annuel
   - Taux d'assurance
   - TAF (Taxe sur les Activités Financières)
3. Choisissez le type d'amortissement :
   - Constant
   - Dégressif
4. Consultez :
   - Mensualité
   - Coût total du crédit
   - Tableau d'amortissement détaillé

### 5. Analytics Dashboard

#### Vue d'Ensemble

Le tableau de bord présente :

##### KPIs Principaux
- Volume total des demandes
- Taux d'approbation
- Montant moyen des crédits
- Délai moyen de traitement

##### Graphiques
- **Évolution mensuelle** des demandes
- **Répartition par secteur** d'activité
- **Distribution par montant**
- **Performance par agence**

##### Filtres Disponibles
- Période (Aujourd'hui, 7 jours, 30 jours, Personnalisée)
- Statut des demandes
- Agence
- Secteur d'activité

### 6. Gestion des Utilisateurs

#### Créer un Utilisateur

1. Accédez à **Gestion des Utilisateurs** (Admin uniquement)
2. Cliquez sur **"Nouvel Utilisateur"**
3. Remplissez :
   - Informations personnelles
   - Email (login)
   - Rôle
   - Département
   - Agence
   - Statut (Actif/Inactif)
4. L'utilisateur recevra ses identifiants par email

#### Gérer les Rôles

Chaque rôle a des permissions spécifiques :

**Administrateur :**
- Toutes les permissions
- Gestion des utilisateurs
- Configuration du système

**Directeur Général :**
- Vue sur toutes les demandes
- Approbation finale des gros montants
- Accès aux analytics

**Comité de Crédit :**
- Évaluation des demandes ≥ 5M XOF
- Vote sur les approbations
- Accès aux analyses complètes

**Directeur d'Agence :**
- Gestion de son agence
- Approbation < 5M XOF
- Pré-approbation ≥ 5M XOF

**Analyste Crédit :**
- Analyse des demandes
- Calcul des scores
- Recommandations

**Chargé d'Affaires :**
- Création de demandes
- Suivi des clients
- Mise à jour des dossiers

### 7. Configuration Système

#### Départements

1. Accédez à **Paramètres** → **Départements**
2. Créez/Modifiez les départements :
   - Nom
   - Description
   - Responsable
   - Statut

#### Agences

1. Accédez à **Paramètres** → **Agences**
2. Gérez les agences :
   - Nom et code
   - Adresse complète
   - Contact
   - Directeur
   - Statut

#### Limites d'Approbation

1. Accédez à **Paramètres** → **Limites d'Approbation**
2. Configurez par rôle :
   - Montant minimum
   - Montant maximum
   - Devise
   - Validation par comité (Oui/Non)
   - Nombre minimum de membres

---

## Gestion des Rôles et Permissions

### Matrice de Permissions

| Fonctionnalité | Admin | Dir. Général | Comité | Dir. Agence | Analyste | Chargé Aff. |
|---------------|-------|--------------|--------|-------------|----------|-------------|
| Créer demande | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analyser | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approuver < 5M | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approuver ≥ 5M | ✅ | ✅ | ✅ | Pré-appr. | ❌ | ❌ |
| Gérer utilisateurs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Config. système | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Analytics global | ✅ | ✅ | ✅ | Agence | ❌ | ❌ |

### Workflow de Décision

```
Demande créée
    ↓
[Montant < 5M XOF]         [Montant ≥ 5M XOF]
    ↓                            ↓
Analyste Crédit             Analyste Crédit
    ↓                            ↓
Directeur d'Agence          Directeur d'Agence
    ↓                            ↓
DÉCISION                    Comité de Crédit
                                 ↓
                            Direction Générale
                                 ↓
                              DÉCISION
```

---

## FAQ

### Questions Générales

**Q: Comment réinitialiser mon mot de passe ?**
R: Contactez votre administrateur système ou utilisez la fonction "Mot de passe oublié" sur la page de connexion.

**Q: Puis-je modifier une demande après soumission ?**
R: Non, une fois soumise, la demande entre dans le workflow. Contactez un administrateur pour toute modification.

**Q: Comment obtenir l'historique d'un client ?**
R: Dans Gestion des Clients, cliquez sur le client puis l'onglet "Historique".

### Workflow

**Q: Que se passe-t-il si une demande est refusée ?**
R: La demande est clôturée. Le client peut soumettre une nouvelle demande avec des ajustements.

**Q: Combien de temps prend le processus d'approbation ?**
R: Cela dépend du montant :
- < 5M XOF : 2-3 jours ouvrables
- ≥ 5M XOF : 5-7 jours ouvrables

**Q: Puis-je suivre l'avancement d'une demande ?**
R: Oui, dans le module Workflow, vous voyez l'étape actuelle et l'historique complet.

### Technique

**Q: Quels formats de documents sont acceptés ?**
R: PDF, JPG, PNG, Excel (.xlsx), Word (.docx) - Taille max : 10MB

**Q: Les données sont-elles sauvegardées automatiquement ?**
R: Oui, toutes les données sont sauvegardées en temps réel dans la base de données.

**Q: La plateforme est-elle accessible sur mobile ?**
R: Oui, l'interface est responsive et s'adapte aux tablettes et smartphones.

---

## Support

Pour toute assistance technique :
- 📧 Email : contact@kaizen-corporation.com
- 📞 Téléphone : +221 XX XXX XX XX
- 🌐 Site web : www.kaizen-corporation.com

---

© 2025 Kaizen Business Support - Tous droits réservés
