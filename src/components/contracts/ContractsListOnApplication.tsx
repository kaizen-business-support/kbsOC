import React, { useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Stack, Button, IconButton, Tooltip,
  Chip, Avatar, Divider, Alert,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import GroupIcon from '@mui/icons-material/Group';
import SendIcon from '@mui/icons-material/Send';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CancelIcon from '@mui/icons-material/Cancel';
import { contractApi } from '../../services/api';
import { GeneratedContract } from '../../types/contracts';
import { ContractStatusChip } from './ContractStatusChip';
import { ContractSignatoriesDialog } from './ContractSignatoriesDialog';
import { SendForSignatureDialog } from './SendForSignatureDialog';

interface Props {
  contracts: GeneratedContract[];
  applicationDefaults?: {
    bankFullName?: string; bankEmail?: string;
    clientFullName?: string; clientEmail?: string;
  };
  onChanged: () => void;
}

export function ContractsListOnApplication({ contracts, applicationDefaults, onChanged }: Props) {
  const [signatoriesFor, setSignatoriesFor] = useState<GeneratedContract | null>(null);
  const [sendFor, setSendFor] = useState<GeneratedContract | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  if (contracts.length === 0) {
    return <Alert severity="info">Aucun contrat généré pour ce dossier.</Alert>;
  }

  const handleUploadSigned = async (contractId: string, file: File) => {
    const r = await contractApi.uploadSigned(contractId, file);
    if (r.success) onChanged();
    else alert(r.error);
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Annuler ce contrat ?')) return;
    const r = await contractApi.cancel(id);
    if (r.success) onChanged();
    else alert(r.error);
  };

  return (
    <>
      <Stack spacing={2}>
        {contracts.map((c) => (
          <Card key={c.id} variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{c.template?.name || 'Contrat'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Généré le {new Date(c.generatedAt).toLocaleDateString('fr-FR')}
                  </Typography>
                </Box>
                <ContractStatusChip status={c.status} />
              </Box>

              {c.signatories.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Signataires
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {c.signatories.map((s) => (
                      <Tooltip key={s.id} title={`${s.fullName} (${s.party === 'BANK' ? 'Banque' : 'Client'})${s.email ? ' — ' + s.email : ''}`}>
                        <Chip
                          size="small"
                          avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: s.party === 'BANK' ? '#1d4ed8' : '#15803d' }}>
                            {s.fullName.charAt(0).toUpperCase()}
                          </Avatar>}
                          label={s.fullName}
                          color={s.status === 'SIGNED' ? 'success' : s.status === 'DECLINED' ? 'error' : 'default'}
                          variant={s.status === 'SIGNED' ? 'filled' : 'outlined'}
                        />
                      </Tooltip>
                    ))}
                  </Stack>
                </Box>
              )}

              <Divider sx={{ my: 1.5 }} />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  href={contractApi.downloadUrl(c.id, false)}
                >
                  Original
                </Button>
                {c.status === 'SIGNED' && (
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    color="success"
                    href={contractApi.downloadUrl(c.id, true)}
                  >
                    PDF signé
                  </Button>
                )}
                {c.status === 'DRAFT' && (
                  <>
                    <Button
                      size="small"
                      startIcon={<GroupIcon />}
                      onClick={() => setSignatoriesFor(c)}
                    >
                      Signataires
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SendIcon />}
                      onClick={() => setSendFor(c)}
                      disabled={c.signatories.length === 0}
                    >
                      Envoyer en signature
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() => handleCancel(c.id)}
                    >
                      Annuler
                    </Button>
                  </>
                )}
                {c.status === 'PENDING_SIGNATURE' && c.signatureMode === 'MANUAL' && (
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<UploadFileIcon />}
                      component="label"
                    >
                      Téléverser PDF signé
                      <input
                        type="file"
                        accept=".pdf"
                        hidden
                        ref={(el) => { fileInputs.current[c.id] = el; }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadSigned(c.id, f);
                        }}
                      />
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() => handleCancel(c.id)}
                    >
                      Annuler
                    </Button>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {signatoriesFor && (
        <ContractSignatoriesDialog
          contract={signatoriesFor}
          defaults={applicationDefaults}
          onClose={() => setSignatoriesFor(null)}
          onSaved={() => { setSignatoriesFor(null); onChanged(); }}
        />
      )}

      {sendFor && (
        <SendForSignatureDialog
          contract={sendFor}
          externalProviderConfigured={false}
          onClose={() => setSendFor(null)}
          onSent={() => { setSendFor(null); onChanged(); }}
        />
      )}
    </>
  );
}
