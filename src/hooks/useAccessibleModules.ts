/**
 * useAccessibleModules
 *
 * Source unique de vérité pour la liste des modules accessibles à
 * l'utilisateur courant, regroupés par thème. Consommée par la Sidebar
 * (verticale) et par la HomePage (cards). Garantit qu'aucune des deux
 * UIs ne peut proposer un module que l'autre cache.
 *
 * La logique reflète celle hardcodée dans Sidebar.tsx avant extraction
 * (commit 32960a4~).
 */

import {
  GroupsOutlined, NoteAddOutlined, AccountTreeOutlined, InsightsOutlined,
  EditNoteOutlined, QueryStatsOutlined, SummarizeOutlined, ManageAccountsOutlined,
  CreditCardOutlined, GavelOutlined, EventNoteOutlined, BackupOutlined,
  CampaignOutlined, NotificationsNone, TuneOutlined, RequestQuoteOutlined,
} from '@mui/icons-material';
import { PageType } from '../types';
import { useUser } from '../contexts/UserContext';
import { useModuleAccess } from './useModuleAccess';

export interface AccessibleModule {
  id: PageType;
  label: string;
  description: string;
  icon: React.ElementType;
}

export interface AccessibleModuleGroup {
  label: string;
  modules: AccessibleModule[];
}

export function useAccessibleModules(): AccessibleModuleGroup[] {
  const { isRole, hasPermission, state: userState } = useUser();
  const { canAccess, canAction } = useModuleAccess();

  const perms = userState.currentUser?.permissions ?? [];
  const isAdmin              = isRole('admin') || perms.includes('*');
  const isManagement         = isRole('management');

  const canViewApplications  = (hasPermission('view_applications') || hasPermission('view_own') || isAdmin) && canAccess('credit-application');
  const canViewClients       = (canViewApplications || hasPermission('create_client') || hasPermission('manage_clients')) && canAccess('clients');
  const canCreateApplication = hasPermission('create_application') && canAccess('credit-application');
  const canDispatching       = hasPermission('dispatch_applications') && canAccess('dispatching');
  const canViewAnalytics     = hasPermission('analytics') && canAccess('analytics');
  const canFinancialAnalysis = hasPermission('financial_analysis') || hasPermission('analyze_credit');
  const canViewReports       = (hasPermission('reports') || isAdmin) && canAccess('analytics');
  const canViewConfiguration = hasPermission('user_management') || isAdmin;
  const canViewPlatformAdmin = perms.includes('manage_platform');
  const canViewCreditPolicy  = (hasPermission('policy_configuration') || isAdmin) && canAccess('credit-policy');
  const canViewCodir         = (hasPermission('codir_dashboard') || isAdmin) && canAccess('codir-dashboard');
  const canManageContractTemplates = hasPermission('manage_contract_templates') || isAdmin || isManagement || canAction('contract-templates', 'upload');

  const creditProcess: AccessibleModule[] = [
    ...(canViewClients       ? [{ id: 'clients'            as PageType, label: 'Clients',           description: 'Annuaire & fiches clients',     icon: GroupsOutlined      }] : []),
    ...(canCreateApplication ? [{ id: 'credit-application' as PageType, label: 'Nouvelle Demande',  description: 'Créer un dossier de crédit',    icon: NoteAddOutlined     }] : []),
    ...(canDispatching       ? [{ id: 'dispatching'        as PageType, label: 'Dispatching',       description: 'Affecter les dossiers entrants',icon: AccountTreeOutlined }] : []),
    ...(canViewApplications  ? [{ id: 'approvals'          as PageType, label: 'Approbations',      description: 'Étapes en attente de décision', icon: RequestQuoteOutlined}] : []),
    ...(canViewApplications  ? [{ id: 'workflow'           as PageType, label: 'Workflow',          description: "Circuit d'instruction",         icon: AccountTreeOutlined }] : []),
    ...(canViewAnalytics     ? [{ id: 'analytics'          as PageType, label: 'Analytiques',       description: 'Tableaux de bord agrégés',      icon: InsightsOutlined    }] : []),
    ...(canViewCodir         ? [{ id: 'codir-dashboard'    as PageType, label: 'CODIR',             description: 'Vue exécutive temps réel',      icon: InsightsOutlined    }] : []),
  ];

  const outOfProcess: AccessibleModule[] = canFinancialAnalysis ? [
    { id: 'data-input' as PageType, label: 'Saisie de Données', description: 'Importer/saisir des données financières', icon: EditNoteOutlined },
    { id: 'analysis'   as PageType, label: 'Analyse',           description: 'Diagnostic financier détaillé',           icon: QueryStatsOutlined },
    ...(canViewReports ? [{ id: 'reports' as PageType, label: 'Rapports', description: 'Exports & synthèses', icon: SummarizeOutlined }] : []),
  ] : [];

  const configuration: AccessibleModule[] = canViewConfiguration ? [
    { id: 'user-management'      as PageType, label: 'Utilisateurs',         description: 'Gestion des comptes',          icon: ManageAccountsOutlined },
    ...(canViewCreditPolicy ? [{ id: 'credit-policy' as PageType, label: 'Politique de Crédit', description: 'Règles, étapes, plafonds', icon: GavelOutlined }] : []),
    ...(canManageContractTemplates ? [{ id: 'contract-templates' as PageType, label: 'Modèles de contrats', description: 'Templates & variables', icon: CreditCardOutlined }] : []),
    { id: 'bank-holidays-admin'  as PageType, label: 'Jours Fériés',         description: 'Calendrier ouvré',             icon: EventNoteOutlined },
    { id: 'backup'               as PageType, label: 'Sauvegarde',           description: 'Exports & restauration',       icon: BackupOutlined },
    { id: 'announcements'        as PageType, label: "Notes d'information",  description: 'Diffusion interne',            icon: CampaignOutlined },
    { id: 'notifications-config' as PageType, label: 'Notifications',        description: 'Règles & destinataires',       icon: NotificationsNone },
    ...(canViewPlatformAdmin ? [{ id: 'platform-admin' as PageType, label: 'Admin Plateforme', description: 'Réglages globaux', icon: TuneOutlined }] : []),
  ] : [];

  const groups: AccessibleModuleGroup[] = [];
  if (creditProcess.length) groups.push({ label: 'Processus Crédit',       modules: creditProcess });
  if (outOfProcess.length)  groups.push({ label: 'Analyse Hors-Processus', modules: outOfProcess });
  if (configuration.length) groups.push({ label: 'Configuration',          modules: configuration });
  return groups;
}
