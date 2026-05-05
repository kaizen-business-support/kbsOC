import crypto from 'crypto';
import fs from 'fs';
import { SignatureProvider, ProviderStatus } from '../signatureService';
import { GeneratedContract, ContractSignatory } from '@prisma/client';

export interface DocuSealConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
}

/**
 * DocuSeal — provider open source self-hosted (AGPLv3).
 * Doc API : https://www.docuseal.com/docs/api
 */
export class DocuSealProvider implements SignatureProvider {
  constructor(private cfg: DocuSealConfig) {}

  async sendForSignature(
    contract: GeneratedContract & { document: any },
    signatories: ContractSignatory[],
  ): Promise<{ providerRef: string }> {
    if (!contract.document?.filePath) {
      throw new Error('Document du contrat introuvable sur disque');
    }
    const fileBuf = fs.readFileSync(contract.document.filePath);

    // 1. Upload du document → crée un template DocuSeal
    const uploadRes = await fetch(`${this.cfg.baseUrl}/api/templates/document`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': this.cfg.apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuf,
    });
    if (!uploadRes.ok) {
      throw new Error(`DocuSeal upload échoué (${uploadRes.status}): ${await uploadRes.text()}`);
    }
    const uploadJson = (await uploadRes.json()) as { id: string | number };
    const templateId = String(uploadJson.id);

    // 2. Créer une submission avec les signataires
    const submissionRes = await fetch(`${this.cfg.baseUrl}/api/submissions`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': this.cfg.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        send_email: true,
        submitters: signatories.map((s) => ({
          name: s.fullName,
          email: s.email,
          role: s.role || s.party,
        })),
      }),
    });
    if (!submissionRes.ok) {
      throw new Error(`DocuSeal submission échouée (${submissionRes.status}): ${await submissionRes.text()}`);
    }
    const data = (await submissionRes.json()) as any;
    return { providerRef: String(data.id) };
  }

  async getStatus(providerRef: string): Promise<ProviderStatus> {
    const r = await fetch(`${this.cfg.baseUrl}/api/submissions/${providerRef}`, {
      headers: { 'X-Auth-Token': this.cfg.apiKey },
    });
    if (!r.ok) {
      throw new Error(`DocuSeal getStatus échoué (${r.status})`);
    }
    const j = (await r.json()) as any;
    const status: ProviderStatus['status'] =
      j.status === 'completed' ? 'signed' :
      j.status === 'declined' ? 'declined' :
      'pending';
    return {
      status,
      signedFileUrl: j.audit_log_url || j.documents?.[0]?.url,
      signatories: (j.submitters || []).map((s: any) => ({
        externalRef: String(s.id),
        status: s.status === 'completed' ? 'signed' : s.status === 'declined' ? 'declined' : 'pending',
        signedAt: s.completed_at,
      })),
    };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', this.cfg.webhookSecret).update(rawBody).digest('hex');
    let sigBuf: Buffer;
    let expBuf: Buffer;
    try {
      sigBuf = Buffer.from(signature, 'hex');
      expBuf = Buffer.from(expected, 'hex');
    } catch {
      return false;
    }
    if (sigBuf.length !== expBuf.length || sigBuf.length === 0) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  parseWebhook(payload: any): { providerRef: string; event: string; signedFileUrl?: string } {
    return {
      providerRef: String(payload.data?.submission_id ?? payload.submission_id ?? ''),
      event: String(payload.event_type ?? ''),
      signedFileUrl: payload.data?.documents?.[0]?.url,
    };
  }
}
