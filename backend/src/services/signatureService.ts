import { GeneratedContract, ContractSignatory } from '@prisma/client';
import { prisma } from '../prismaClient';
import { decrypt } from '../utils/encryption';
import { DocuSealProvider } from './providers/docusealProvider';

export interface ProviderStatus {
  status: 'pending' | 'signed' | 'declined';
  signedFileUrl?: string;
  signatories: { externalRef: string; status: 'pending' | 'signed' | 'declined'; signedAt?: string }[];
}

export interface SignatureProvider {
  sendForSignature(
    contract: GeneratedContract & { document: any },
    signatories: ContractSignatory[],
  ): Promise<{ providerRef: string }>;
  getStatus(providerRef: string): Promise<ProviderStatus>;
  verifyWebhook(rawBody: string, signature: string): boolean;
  parseWebhook(payload: any): { providerRef: string; event: string; signedFileUrl?: string };
}

/**
 * Charge la config provider chiffrée du tenant et instancie le provider correspondant.
 * Phase 2 : seul DocuSeal est supporté (stub). Phase 3 : implémentation réelle.
 */
export async function getProvider(companyId: string): Promise<SignatureProvider> {
  const c = await prisma.company.findUnique({ where: { id: companyId } });
  const cfg = c?.signatureProviderConfig as any;
  if (!cfg?.ciphertext) {
    throw new Error('Aucun fournisseur de signature configuré pour ce tenant');
  }
  const decoded = JSON.parse(decrypt(cfg.ciphertext)) as
    { provider: 'docuseal'; baseUrl: string; apiKey: string; webhookSecret: string };
  if (decoded.provider === 'docuseal') {
    return new DocuSealProvider({
      baseUrl: decoded.baseUrl,
      apiKey: decoded.apiKey,
      webhookSecret: decoded.webhookSecret,
    });
  }
  throw new Error(`Provider ${decoded.provider} non supporté`);
}
