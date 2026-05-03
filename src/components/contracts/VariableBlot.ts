import ReactQuill from 'react-quill';

const QuillInstance = (ReactQuill as any).Quill;
const Embed = QuillInstance.import('blots/embed') as any;

const GROUP_COLORS: Record<string, string> = {
  client:      '#3b82f6',
  application: '#7c3aed',
  bank:        '#16a34a',
  meta:        '#64748b',
};

export class VariableBlot extends Embed {
  static blotName = 'variable';
  static tagName = 'span';

  static create(value: { variable: string; label: string; group: string }) {
    const node = super.create() as HTMLElement;
    node.setAttribute('data-variable', value.variable);
    node.setAttribute('data-group', value.group);
    node.setAttribute('contenteditable', 'false');
    node.classList.add('ql-variable-chip');
    node.textContent = value.label;
    const color = GROUP_COLORS[value.group] || '#64748b';
    node.style.cssText = [
      `background:${color}18`,
      `color:${color}`,
      'border:1px solid currentColor',
      'border-radius:4px',
      'padding:1px 6px',
      'font-size:12px',
      'font-family:monospace',
      'cursor:default',
      'user-select:none',
      'display:inline-block',
      'margin:0 2px',
    ].join(';');
    return node;
  }

  static value(node: HTMLElement) {
    return {
      variable: node.getAttribute('data-variable') || '',
      label: node.textContent || '',
      group: node.getAttribute('data-group') || '',
    };
  }
}

QuillInstance.register(VariableBlot);

export function serializeEditorContent(quill: any): string {
  const container = quill.root.cloneNode(true) as HTMLElement;
  container.querySelectorAll<HTMLElement>('.ql-variable-chip').forEach((chip) => {
    const variable = chip.getAttribute('data-variable') || '';
    const text = document.createTextNode(variable);
    chip.replaceWith(text);
  });
  return container.innerHTML;
}

export function deserializeHtmlToQuill(html: string, quill: any): void {
  const markedHtml = html.replace(
    /\{\{\s*([\w][\w.]*)\s*\}\}/g,
    (_, v) => `<span class="ql-variable-chip" data-variable="{{${v}}}" data-group="${v.split('.')[0]}">${v}</span>`,
  );
  quill.clipboard.dangerouslyPasteHTML(markedHtml);
}
