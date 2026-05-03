import fs from 'fs';
import PizZip from 'pizzip';
import { isCatalogVariable } from '../constants/contractVariables';

const VAR_RE = /\{\{\s*([\w][\w.]*)\s*\}\}/g;

export function extractVariablesFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(VAR_RE)) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

export function extractVariablesFromDocx(filePath: string): string[] {
  const data = fs.readFileSync(filePath);
  const zip = new PizZip(data);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  // Word fragmente parfois les {{...}} entre runs : strip XML pour reconstruire le texte
  const text = xml.replace(/<[^>]+>/g, '');
  return extractVariablesFromText(text);
}

export function classifyVariables(vars: string[]): { catalog: string[]; custom: string[] } {
  const catalog: string[] = [];
  const custom: string[] = [];
  for (const v of vars) (isCatalogVariable(v) ? catalog : custom).push(v);
  return { catalog, custom };
}

export function validateMagicBytes(buf: Buffer, format: 'DOCX' | 'PDF'): boolean {
  if (format === 'DOCX') {
    return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  }
  if (format === 'PDF') {
    return buf.length >= 4 && buf.slice(0, 4).toString('utf8') === '%PDF';
  }
  return false;
}

export function extractVariablesFromHtml(html: string): string[] {
  // Defensive pass: extract data-variable if un-serialized chips arrive
  const withInlined = html.replace(/data-variable="(\{\{[^"]+\}\})"/g, ' $1 ');
  const text = withInlined.replace(/<[^>]+>/g, ' ');
  return extractVariablesFromText(text);
}

export function reconcileCustomFields(
  existing: Array<{ name: string; label: string; type: string; required: boolean }>,
  detectedCustomNames: string[],
): Array<{ name: string; label: string; type: string; required: boolean }> {
  const existingMap = new Map(existing.map((f) => [f.name, f]));
  return detectedCustomNames.map((name) =>
    existingMap.get(name) ?? { name, label: name, type: 'text', required: false },
  );
}
