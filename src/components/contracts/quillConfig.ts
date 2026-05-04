import ReactQuill from 'react-quill';

const Quill = (ReactQuill as any).Quill;
const Delta = Quill.import('delta');

// Clipboard matcher: convert <span class="ql-variable-chip"> back to VariableBlot ops
// This is required for dangerouslyPasteHTML to correctly restore chip embeds.
const chipMatcher = (node: HTMLElement) =>
  new Delta().insert({
    variable: {
      variable: node.getAttribute('data-variable') || '',
      label: node.textContent || '',
      group: node.getAttribute('data-group') || '',
    },
  });

export const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['blockquote'],
    ['clean'],
  ],
  clipboard: {
    matchers: [['span.ql-variable-chip', chipMatcher]],
  },
};
