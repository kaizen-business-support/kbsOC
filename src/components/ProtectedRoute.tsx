import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useModuleAccess } from '../hooks/useModuleAccess';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * OR logic : l'accès est accordé si l'utilisateur possède AU MOINS UNE
   * des permissions listées. Tableau vide = accessible à tout utilisateur connecté.
   */
  permissions?: string[];
  /**
   * Clé de module (canAccess) ANDée avec la vérification de permissions.
   * Si absent, la vérification module est ignorée.
   */
  moduleKey?: string;
  /** Page de redirection en cas d'accès refusé (défaut : '/') */
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permissions = [],
  moduleKey,
  redirectTo = '/',
}) => {
  const { hasPermission, state } = useUser();
  const { canAccess } = useModuleAccess();

  const perms = state.currentUser?.permissions ?? [];

  // Wildcard '*' = accès total (ADMIN / SUPER_ADMIN)
  if (perms.includes('*')) return <>{children}</>;

  // Au moins une permission requise
  const hasAnyPermission =
    permissions.length === 0 || permissions.some((p) => hasPermission(p));

  // Vérification du module si fournie
  const hasModuleAccess = !moduleKey || canAccess(moduleKey);

  if (!hasAnyPermission || !hasModuleAccess) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
