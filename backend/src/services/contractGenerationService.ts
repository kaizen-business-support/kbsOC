import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { prisma } from '../prismaClient';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const writtenNumber = require('written-number');

type LoadedApplication = {
  id: string;
  applicationNumber: string;
  amount: any;
  currency: string | null;
  purpose: string | null;
  durationMonths: number | null;
  proposedRate: any;
  collateralType: string | null;
  collateralValue: any;
  repaymentSchedule: string | null;
  companyId: string | null;
  client: any;
  creditType: any;
  company: any;
};

async function loadApplication(applicationId: string): Promise<LoadedApplication> {
  return prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { client: true, creditType: true, company: true },
  }) as any;
}

function nullToEmpty<T>(v: T): T | '' {
  return v === null || v === undefined ? '' : v;
}

export function buildMergeContext(app: LoadedApplication, customValues: Record<string, any>) {
  const amount = Number(app.amount) || 0;
  const amountInWords = writtenNumber(amount, { lang: 'fr' }) + ' francs CFA';
  const ctx: any = {
    client: {
      companyName: nullToEmpty(app.client?.companyName),
      rccm: nullToEmpty(app.client?.rccm),
      ninea: nullToEmpty(app.client?.ninea),
      legalForm: nullToEmpty(app.client?.legalForm),
      headquarters: nullToEmpty(app.client?.headquarters),
      contactPerson: nullToEmpty(app.client?.contactPerson),
      phone: nullToEmpty(app.client?.phone),
      email: nullToEmpty(app.client?.email),
    },
    application: {
      applicationNumber: app.applicationNumber,
      amount,
      amountInWords,
      currency: nullToEmpty(app.currency),
      purpose: nullToEmpty(app.purpose),
      durationMonths: nullToEmpty(app.durationMonths),
      proposedRate: nullToEmpty(app.proposedRate ? Number(app.proposedRate) : null),
      collateralType: nullToEmpty(app.collateralType),
      collateralValue: nullToEmpty(app.collateralValue ? Number(app.collateralValue) : null),
      repaymentSchedule: nullToEmpty(app.repaymentSchedule),
    },
    bank: {
      name: nullToEmpty(app.company?.name),
      headquarters: nullToEmpty(app.company?.headquarters),
      legalRepresentative: nullToEmpty(app.company?.legalRepresentative),
      rccm: nullToEmpty(app.company?.rccm),
    },
    meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      creditType: nullToEmpty(app.creditType?.name),
    },
    ...customValues,
  };
  return ctx;
}

export function flattenContext(obj: any, prefix = ''): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      Object.assign(out, flattenContext(v, key));
    }
    out[key] = v;
  }
  return out;
}

export interface GenerateOptions {
  templateId: string;
  applicationId: string;
  customValues: Record<string, any>;
  userId: string;
}

export async function generateContract(opts: GenerateOptions) {
  const template = await prisma.contractTemplate.findUniqueOrThrow({ where: { id: opts.templateId } });
  const app = await loadApplication(opts.applicationId);
  if (template.companyId !== app.companyId) {
    throw new Error('Tenant mismatch');
  }
  const contractId = crypto.randomBytes(8).toString('hex');
  const outDir = path.join(__dirname, '../../uploads/contracts', opts.applicationId);
  fs.mkdirSync(outDir, { recursive: true });

  let outFilename: string;
  let outPath: string;

  if (template.fileFormat === 'DOCX') {
    const data = fs.readFileSync(template.filePath!);
    const zip = new PizZip(data);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    const ctx = buildMergeContext(app, opts.customValues);
    doc.render(flattenContext(ctx));
    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    outFilename = `${contractId}.docx`;
    outPath = path.join(outDir, outFilename);
    fs.writeFileSync(outPath, buf);
  } else if (template.fileFormat === 'PDF') {
    outFilename = `${contractId}.pdf`;
    outPath = path.join(outDir, outFilename);
    fs.copyFileSync(template.filePath!, outPath);
  } else {
    // RICH_TEXT: implemented in Task 3
    throw new Error(`generateContract: RICH_TEXT generation not yet implemented (templateId=${template.id})`);
  }

  const document = await prisma.document.create({
    data: {
      applicationId: opts.applicationId,
      filename: outFilename,
      filePath: outPath,
      fileSize: fs.statSync(outPath).size,
      mimeType: template.fileFormat === 'DOCX'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf',
      category: 'CONTRACT',
      uploadedBy: opts.userId,
    },
  });

  return prisma.generatedContract.create({
    data: {
      applicationId: opts.applicationId,
      templateId: template.id,
      documentId: document.id,
      status: 'DRAFT',
      customValues: opts.customValues,
      generatedBy: opts.userId,
    },
    include: { document: true, template: true, signatories: true },
  });
}
