import React from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Chip,
  Avatar,
  Stack,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as PendingIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { WorkflowTimestamps, WorkflowStep } from '../types';
import { FIXED_WORKFLOW_STEPS, getExpectedWorkflowSteps, getApprovalStepConfig } from '../utils/workflowConfig';

interface WorkflowTimelineProps {
  workflow: WorkflowTimestamps;
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ workflow }) => {
  // Safety check for workflow data
  if (!workflow) {
    return (
      <Box>
        <Typography variant="h6" color="error">
          Erreur: Données de workflow manquantes
        </Typography>
      </Box>
    );
  }

  if (!workflow.steps || workflow.steps.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Workflow sans étapes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ce workflow ne contient pas encore d'étapes définies.
        </Typography>
      </Box>
    );
  }
  const getStepIcon = (step: WorkflowStep) => {
    if (step.completedAt) {
      return <CheckCircleIcon color="success" />;
    } else if (step.startedAt && !step.completedAt) {
      return <ScheduleIcon color="primary" />;
    } else {
      return <PendingIcon color="disabled" />;
    }
  };

  const getStepStatus = (step: WorkflowStep) => {
    if (step.completedAt) {
      return 'completed';
    } else if (step.startedAt && !step.completedAt) {
      return 'active';
    } else {
      return 'pending';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = end - start;
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days}j ${hours}h`;
    } else {
      return `${hours}h`;
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrentStep = () => {
    return workflow.steps.find(step => step && !step.completedAt);
  };

  const getNextStepInfo = () => {
    if (workflow.finalDecision) {
      return null; // Workflow is complete
    }

    const currentStep = getCurrentStep();
    if (!currentStep) {
      return null;
    }

    // Check if current step is a fixed step
    const currentStepConfig = FIXED_WORKFLOW_STEPS[currentStep.stepId];
    if (currentStepConfig && currentStepConfig.nextSteps && currentStepConfig.nextSteps.length > 0) {
      const nextStepId = currentStepConfig.nextSteps[0];
      return FIXED_WORKFLOW_STEPS[nextStepId];
    }

    // For dynamic approval steps, next step is always final_decision
    if (currentStep.stepId.includes('_review')) {
      return FIXED_WORKFLOW_STEPS.final_decision;
    }

    return null;
  };

  return (
    <Box>
      {/* Workflow Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Résumé du Workflow
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} divider={<Divider orientation="vertical" flexItem />}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Statut
              </Typography>
              <Chip
                label={
                  workflow.finalDecision === 'approved' ? 'Approuvé' :
                  workflow.finalDecision === 'rejected' ? 'Refusé' :
                  'En cours'
                }
                color={
                  workflow.finalDecision === 'approved' ? 'success' :
                  workflow.finalDecision === 'rejected' ? 'error' :
                  'primary'
                }
                size="small"
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Démarré le
              </Typography>
              <Typography variant="body2">
                {formatDate(workflow.totalStartedAt)}
              </Typography>
            </Box>
            {workflow.totalCompletedAt && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Terminé le
                </Typography>
                <Typography variant="body2">
                  {formatDate(workflow.totalCompletedAt!)}
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="body2" color="text.secondary">
                Durée totale
              </Typography>
              <Typography variant="body2">
                {workflow.totalCompletedAt
                  ? formatDuration(workflow.totalStartedAt, workflow.totalCompletedAt)
                  : formatDuration(workflow.totalStartedAt)}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Next Step Information */}
      {getNextStepInfo() && (
        <Card sx={{ mb: 3, bgcolor: '#e3f2fd', borderLeft: '4px solid', borderColor: 'info.main' }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="info.main" gutterBottom>
                  📋 Prochaine étape
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {getNextStepInfo()?.stepName}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {getNextStepInfo()?.description}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Chip
                    label={`Rôles requis: ${getNextStepInfo()?.requiredRoles.join(', ')}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`Durée prévue: ${getNextStepInfo()?.expectedDuration} jour${getNextStepInfo()?.expectedDuration !== 1 ? 's' : ''}`}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Workflow Steps Timeline */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Étapes du Workflow
          </Typography>

          <Stepper orientation="vertical" nonLinear>
            {(() => {
              // Get all expected steps based on amount and approval status
              const expectedStepIds = getExpectedWorkflowSteps(
                workflow.requestedAmount,
                workflow.finalDecision === 'approved'
              );

              // Map each expected step to either actual step data or pending step
              return expectedStepIds.map((stepId, index) => {
                const actualStep = workflow.steps.find(s => s.stepId === stepId);

                // Try to get fixed step config, or if it's a dynamic approval step, get from approval config
                let stepConfig = FIXED_WORKFLOW_STEPS[stepId];
                if (!stepConfig && stepId.includes('_review')) {
                  // This is a dynamic approval step, get config based on amount
                  const approvalConfig = getApprovalStepConfig(workflow.requestedAmount);
                  if (approvalConfig && approvalConfig.stepId === stepId) {
                    stepConfig = approvalConfig;
                  }
                }

                // Fallback if step config not found
                if (!stepConfig) {
                  stepConfig = {
                    stepId: stepId,
                    stepName: stepId,
                    description: `Étape: ${stepId}`,
                    expectedDuration: 1,
                    requiredRoles: ['system'],
                    isApprovalStep: false,
                    nextSteps: []
                  };
                }

                // For pending steps (not yet started), we need to handle them differently
                let stepStatus: 'completed' | 'active' | 'pending';
                let step: any;

                if (actualStep) {
                  step = actualStep;
                  stepStatus = getStepStatus(step);
                } else {
                  // This is a pending step that hasn't started yet
                  step = null;
                  stepStatus = 'pending';
                }
              
              return (
                <Step key={stepId} active={stepStatus === 'active'} completed={stepStatus === 'completed'}>
                  <StepLabel
                    icon={step ? getStepIcon(step) : <PendingIcon color="disabled" />}
                    optional={
                      step?.completedAt && (
                        <Typography variant="caption" color="text.secondary">
                          Terminé le {formatDate(step.completedAt)}
                        </Typography>
                      )
                    }
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight={stepStatus === 'active' ? 600 : 400}>
                        {stepConfig.stepName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stepConfig.description}
                      </Typography>
                    </Box>
                  </StepLabel>
                  
                  <StepContent>
                    {step ? (
                      <Card variant="outlined" sx={{ mt: 1, mb: 2 }}>
                        <CardContent>
                          <Stack spacing={2}>
                            {/* Step Details */}
                            <Box>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Détails de l'étape
                              </Typography>
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar sx={{ width: 24, height: 24 }}>
                                  <PersonIcon fontSize="small" />
                                </Avatar>
                                <Typography variant="body2">
                                  {stepConfig.requiredRoles.join(', ') || 'Système automatique'}
                                </Typography>
                              </Stack>
                            </Box>

                            {/* Timing Information */}
                            <Box>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Chronologie
                              </Typography>
                              <Stack spacing={1}>
                                {step.startedAt && (
                                  <Typography variant="body2">
                                    🟢 Démarré le {formatDate(step.startedAt)}
                                  </Typography>
                                )}
                                {step.completedAt && (
                                  <Typography variant="body2">
                                    ✅ Terminé le {formatDate(step.completedAt)}
                                  </Typography>
                                )}
                                {step.startedAt && (
                                  <Typography variant="body2" color="text.secondary">
                                    Durée: {formatDuration(step.startedAt, step.completedAt)}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>

                            {/* Step Result */}
                            {step.decision && (
                              <Box>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Résultat
                                </Typography>
                                <Chip
                                  label={step.decision}
                                  color={step.decision === 'approved' ? 'success' :
                                        step.decision === 'rejected' ? 'error' : 'default'}
                                  size="small"
                                />
                              </Box>
                            )}

                            {/* Comments */}
                            {step.comments && (
                              <Box>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Commentaires
                                </Typography>
                                <Typography variant="body2" sx={{
                                  p: 1,
                                  bgcolor: 'grey.50',
                                  borderRadius: 1,
                                  fontStyle: 'italic'
                                }}>
                                  "{step.comments}"
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card variant="outlined" sx={{ mt: 1, mb: 2, bgcolor: 'grey.50' }}>
                        <CardContent>
                          <Typography variant="body2" color="text.secondary">
                            Cette étape est en attente et n'a pas encore été démarrée.
                          </Typography>
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Rôles requis:
                            </Typography>
                            <Typography variant="body2">
                              {stepConfig.requiredRoles.join(', ')}
                            </Typography>
                          </Box>
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Durée prévue:
                            </Typography>
                            <Typography variant="body2">
                              {stepConfig.expectedDuration} jour{stepConfig.expectedDuration !== 1 ? 's' : ''}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    )}
                  </StepContent>
                </Step>
              );
              });
            })()}
          </Stepper>
        </CardContent>
      </Card>

      {/* Final Decision */}
      {workflow.finalDecision && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Décision Finale
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={workflow.finalDecision === 'approved' ? 'APPROUVÉ' : 'REFUSÉ'}
                color={workflow.finalDecision === 'approved' ? 'success' : 'error'}
                variant="filled"
                sx={{ fontWeight: 600 }}
              />
              {workflow.finalDecision === 'approved' && (
                <Typography variant="body1">
                  Montant demandé: {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: workflow.currency
                  }).format(workflow.requestedAmount)}
                </Typography>
              )}
            </Stack>
            {workflow.steps.some(step => step.comments) && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Commentaires finaux
                </Typography>
                <Typography variant="body2" sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 1,
                  fontStyle: 'italic'
                }}>
                  "{workflow.steps.find(step => step.comments)?.comments || 'Aucun commentaire'}"
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};