import { SignatureProvider, ProviderStatus } from '../signatureService';

export interface DocuSealConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
}

/**
 * Stub Phase 2 — l'implémentation réelle (envoi document, polling statut,
 * vérification HMAC, parsing webhook) arrive en Phase 3.
 */
export class DocuSealProvider implements SignatureProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_cfg: DocuSealConfig) {}

  async sendForSignature(): Promise<{ providerRef: string }> {
    throw new Error('DocuSeal: implémentation à venir en Phase 3');
  }

  async getStatus(): Promise<ProviderStatus> {
    throw new Error('DocuSeal: implémentation à venir en Phase 3');
  }

  verifyWebhook(): boolean {
    throw new Error('DocuSeal: implémentation à venir en Phase 3');
  }

  parseWebhook(): { providerRef: string; event: string; signedFileUrl?: string } {
    throw new Error('DocuSeal: implémentation à venir en Phase 3');
  }
}
