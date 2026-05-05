export type ContractFileFormat = 'DOCX' | 'PDF' | 'RICH_TEXT';
export type ContractStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'ARCHIVED' | 'CANCELLED';
export type SignatureMode = 'MANUAL' | 'EXTERNAL';
export type SignatoryParty = 'BANK' | 'CLIENT';
export type SignatoryStatus = 'PENDING' | 'SIGNED' | 'DECLINED';
export type CustomFieldType = 'text' | 'number' | 'date';

export interface ContractCustomField {
  name: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
}

export interface ContractTemplate {
  id: string;
  companyId: string;
  name: string;
  documentType: string;
  description: string | null;
  fileFormat: ContractFileFormat;
  filePath: string | null;
  fileSize: number | null;
  originalName: string | null;
  htmlContent: string | null;
  creditTypeIds: string[];
  customFields: ContractCustomField[];
  detectedVariables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContractSignatory {
  id: string;
  contractId: string;
  order: number;
  party: SignatoryParty;
  fullName: string;
  email: string | null;
  role: string | null;
  status: SignatoryStatus;
  signedAt: string | null;
  externalRef: string | null;
}

export interface GeneratedContract {
  id: string;
  applicationId: string;
  templateId: string;
  template?: ContractTemplate;
  documentId: string | null;
  status: ContractStatus;
  customValues: Record<string, any>;
  signatureMode: SignatureMode | null;
  externalProviderRef: string | null;
  signedFilePath: string | null;
  signedFileHash: string | null;
  generatedAt: string;
  signedAt: string | null;
  cancelledAt: string | null;
  signatories: ContractSignatory[];
}

export interface VariableCatalog {
  groups: Record<string, readonly string[]>;
  flattened: string[];
}
