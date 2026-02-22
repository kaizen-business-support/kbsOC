import React, { ReactNode } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, environmentConfig } from '../config/authConfig';

interface MsalWrapperProps {
  children: ReactNode;
}

// Create MSAL instance only if not in mock mode
let msalInstance: PublicClientApplication | null = null;

const shouldUseMsal = () => {
  const env = process.env.NODE_ENV as 'development' | 'production';
  const config = environmentConfig[env];
  
  // Check if we have necessary environment variables
  const hasRequiredConfig = 
    process.env.REACT_APP_AZURE_CLIENT_ID && 
    process.env.REACT_APP_AZURE_AUTHORITY &&
    !config.enableMockAuth;
    
  return hasRequiredConfig;
};

// Initialize MSAL only if configuration is available
if (shouldUseMsal()) {
  try {
    msalInstance = new PublicClientApplication(msalConfig);
    
    // Initialize MSAL
    msalInstance.initialize().then(() => {
      console.log('MSAL initialized successfully');
    }).catch((error) => {
      console.error('MSAL initialization failed:', error);
      msalInstance = null;
    });
  } catch (error) {
    console.error('Failed to create MSAL instance:', error);
    msalInstance = null;
  }
}

export const MsalWrapper: React.FC<MsalWrapperProps> = ({ children }) => {
  // If MSAL is available and configured, wrap with MsalProvider
  if (msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        {children}
      </MsalProvider>
    );
  }
  
  // Otherwise, render children directly without MSAL
  return <>{children}</>;
};

export default MsalWrapper;