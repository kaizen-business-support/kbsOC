import crypto from 'crypto';
import { DocuSealProvider } from '../services/providers/docusealProvider';

const cfg = {
  baseUrl: 'http://docuseal.local',
  apiKey: 'test-api-key',
  webhookSecret: 'shh-secret',
};

describe('DocuSealProvider.verifyWebhook', () => {
  const p = new DocuSealProvider(cfg);

  it('accepte une signature HMAC-SHA256 valide', () => {
    const body = '{"event_type":"submission.completed","data":{"submission_id":42}}';
    const sig = crypto.createHmac('sha256', cfg.webhookSecret).update(body).digest('hex');
    expect(p.verifyWebhook(body, sig)).toBe(true);
  });

  it('rejette une signature falsifiée', () => {
    const body = '{"x":1}';
    expect(p.verifyWebhook(body, 'a'.repeat(64))).toBe(false);
  });

  it('rejette une signature de longueur incorrecte', () => {
    expect(p.verifyWebhook('{"x":1}', 'short')).toBe(false);
  });
});

describe('DocuSealProvider.parseWebhook', () => {
  const p = new DocuSealProvider(cfg);

  it('extrait providerRef et event d\'un payload completed', () => {
    const payload = {
      event_type: 'submission.completed',
      data: {
        submission_id: 'sub_123',
        documents: [{ url: 'http://docuseal/file.pdf' }],
      },
    };
    const r = p.parseWebhook(payload);
    expect(r.providerRef).toBe('sub_123');
    expect(r.event).toBe('submission.completed');
    expect(r.signedFileUrl).toBe('http://docuseal/file.pdf');
  });

  it('gère un payload sans documents', () => {
    const payload = { event_type: 'submission.declined', data: { submission_id: 99 } };
    const r = p.parseWebhook(payload);
    expect(r.providerRef).toBe('99');
    expect(r.signedFileUrl).toBeUndefined();
  });
});
