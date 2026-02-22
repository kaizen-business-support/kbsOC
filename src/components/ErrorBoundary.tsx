import React, { ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Card,
  CardContent,
  Container,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log error to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Here you would send error to monitoring service like Sentry
      console.error('Production error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleRefresh = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="md" sx={{ py: 8 }}>
          <Card sx={{ textAlign: 'center', p: 4 }}>
            <CardContent>
              <ErrorIcon 
                sx={{ 
                  fontSize: 80, 
                  color: 'error.main', 
                  mb: 3 
                }} 
              />
              
              <Typography variant="h4" component="h1" gutterBottom color="error">
                Oups ! Une erreur s'est produite
              </Typography>
              
              <Typography variant="body1" color="text.secondary" paragraph>
                Une erreur inattendue s'est produite dans l'application. 
                Nos équipes ont été automatiquement notifiées.
              </Typography>

              <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Détails de l'erreur :
                </Typography>
                <Typography variant="body2" component="pre" sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {this.state.error?.message}
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleRefresh}
                  size="large"
                >
                  Actualiser la page
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  size="large"
                >
                  Retour à l'accueil
                </Button>
              </Box>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Stack trace (développement) :
                  </Typography>
                  <Typography 
                    variant="body2" 
                    component="pre" 
                    sx={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {this.state.error?.stack}
                    {this.state.errorInfo.componentStack}
                  </Typography>
                </Alert>
              )}

              <Box sx={{ mt: 4, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Pour obtenir de l'aide, contactez le support technique à{' '}
                  <Typography 
                    component="a" 
                    href="mailto:support@kaizen-corporation.com"
                    sx={{ color: 'primary.main', textDecoration: 'none' }}
                  >
                    support@kaizen-corporation.com
                  </Typography>
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Container>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for easier usage
interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <ErrorIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Erreur dans le composant
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {error.message}
      </Typography>
      <Button variant="contained" onClick={resetError} startIcon={<RefreshIcon />}>
        Réessayer
      </Button>
    </Box>
  );
};

export default ErrorBoundary;