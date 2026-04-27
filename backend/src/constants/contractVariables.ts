export const VARIABLE_CATALOG = {
  client: ['companyName', 'rccm', 'ninea', 'legalForm', 'headquarters', 'contactPerson', 'phone', 'email'],
  application: ['applicationNumber', 'amount', 'amountInWords', 'currency', 'purpose', 'durationMonths',
                'proposedRate', 'collateralType', 'collateralValue', 'repaymentSchedule'],
  bank: ['name', 'headquarters', 'legalRepresentative', 'rccm'],
  meta: ['generatedAt', 'creditType'],
} as const;

export type CatalogGroup = keyof typeof VARIABLE_CATALOG;

export function flattenedCatalog(): string[] {
  return Object.entries(VARIABLE_CATALOG).flatMap(([g, fields]) => fields.map((f) => `${g}.${f}`));
}

export function isCatalogVariable(name: string): boolean {
  return new Set(flattenedCatalog()).has(name);
}
