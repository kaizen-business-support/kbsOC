import { Configuration } from '@azure/msal-browser';

// Azure AD Configuration for OptimusCredit
export const msalConfig: Configuration = {
  auth: {
    // Replace with your Azure AD App Registration Client ID
    clientId: process.env.REACT_APP_AZURE_CLIENT_ID || 'your-client-id-here',
    
    // Replace with your Azure AD tenant ID or use common for multi-tenant
    authority: process.env.REACT_APP_AZURE_AUTHORITY || 'https://login.microsoftonline.com/your-tenant-id',
    
    // Replace with your app's redirect URI (must match Azure AD App Registration)
    redirectUri: process.env.REACT_APP_REDIRECT_URI || window.location.origin + '/optimus',
    
    // Post logout redirect URI
    postLogoutRedirectUri: process.env.REACT_APP_POST_LOGOUT_REDIRECT_URI || window.location.origin + '/optimus',
    
    // Navigate to original request location after login
    navigateToLoginRequestUrl: true,
  },
  cache: {
    // Configure cache location - localStorage is more persistent
    cacheLocation: 'localStorage',
    
    // Avoid sticky sessions (useful for multi-tab scenarios)
    storeAuthStateInCookie: false,
  },
  system: {
    // Log level for debugging (remove in production)
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        
        switch (level) {
          case 0: // Error
            console.error('[MSAL Error]', message);
            break;
          case 1: // Warning  
            console.warn('[MSAL Warning]', message);
            break;
          case 2: // Info
            console.info('[MSAL Info]', message);
            break;
          default:
            console.log('[MSAL]', message);
            break;
        }
      },
      piiLoggingEnabled: false
    }
  }
};

// Scopes required for OptimusCredit application
export const loginRequest = {
  scopes: [
    'User.Read',              // Basic user profile information
    'User.ReadBasic.All',     // Read basic profiles of all users (for team directory)
    'Directory.Read.All',     // Read directory data (for role/department mapping)
    'Mail.Send'               // Send emails (for workflow notifications)
  ]
};

// Silent request configuration for token refresh
export const silentRequest = {
  scopes: ['User.Read'],
  account: null as any // Will be set dynamically
};

// Microsoft Graph API endpoints
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphUsersEndpoint: 'https://graph.microsoft.com/v1.0/users',
  graphMemberOfEndpoint: 'https://graph.microsoft.com/v1.0/me/memberOf'
};

// Role mapping configuration - maps Azure AD groups to OptimusCredit roles
export const roleMapping = {
  // Azure AD Security Group Object IDs to OptimusCredit roles
  // Replace these with your actual Azure AD Security Group IDs
  groups: {
    'account-managers-group-id': 'account_manager',
    'credit-analysts-group-id': 'credit_analyst',
    'branch-managers-group-id': 'branch_manager',
    'credit-committee-group-id': 'credit_committee',
    'management-group-id': 'management',
    'it-admins-group-id': 'admin'
  },
  
  // Fallback role assignment based on job title or department
  departments: {
    'Commercial': 'account_manager',
    'Crédit': 'credit_analyst',
    'Risques': 'credit_analyst',
    'Direction': 'branch_manager',
    'Comité': 'credit_committee',
    'IT': 'admin'
  },
  
  // Default role if no mapping found
  defaultRole: 'account_manager' as const
};

// Permission mapping for each role
export const rolePermissions = {
  account_manager: [
    'create_client',
    'edit_client',
    'view_client',
    'create_application',
    'edit_application',
    'view_application',
    'upload_documents',
    'financial_data_input'
  ],
  credit_analyst: [
    'view_client',
    'view_application',
    'financial_analysis',
    'score_applications',
    'benchmark_analysis',
    'review_applications',
    'approve_small_amounts', // < 1M XOF
    'workflow_progression'
  ],
  branch_manager: [
    'view_client',
    'view_application',
    'financial_analysis',
    'approve_applications', // < 5M XOF
    'reject_applications',
    'workflow_override',
    'team_management',
    'portfolio_view'
  ],
  credit_committee: [
    'view_client',
    'view_application',
    'financial_analysis',
    'approve_applications', // All amounts
    'reject_applications',
    'risk_override',
    'policy_exceptions',
    'committee_review'
  ],
  management: [
    'view_all',
    'portfolio_analytics',
    'risk_reporting',
    'policy_configuration',
    'user_management'
  ],
  admin: [
    'system_administration',
    'user_management',
    'role_assignment',
    'system_configuration',
    'audit_logs',
    'data_export'
  ]
};

// Environment-specific configuration
export const environmentConfig = {
  development: {
    enableMockAuth: false, // Set to true to use mock auth in development
    logLevel: 2, // Info level logging
  },
  production: {
    enableMockAuth: false,
    logLevel: 0, // Error level logging only
  }
};