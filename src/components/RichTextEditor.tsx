import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Box, Typography, Paper } from '@mui/material';

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
  label?: string;
  readOnly?: boolean;
  theme?: 'snow' | 'bubble';
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = 'Saisissez votre analyse...',
  height = 200,
  label,
  readOnly = false,
  theme = 'snow'
}) => {
  const modules = useMemo(() => ({
    toolbar: readOnly ? false : [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean']
    ],
  }), [readOnly]);

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'bullet', 'align',
    'blockquote', 'code-block', 'link'
  ];

  return (
    <Box>
      {label && (
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          {label}
        </Typography>
      )}
      <Paper 
        variant="outlined" 
        sx={{ 
          '& .ql-container': {
            minHeight: `${height}px`,
            fontSize: '14px',
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          },
          '& .ql-editor': {
            minHeight: `${height}px`,
            padding: '12px',
          },
          '& .ql-toolbar': {
            borderBottom: readOnly ? 'none' : '1px solid #ccc',
            display: readOnly ? 'none' : 'block',
          },
          '& .ql-container.ql-snow': {
            border: readOnly ? 'none' : '1px solid #ccc',
            borderTop: readOnly ? 'none' : 'none',
          },
          '& .ql-editor.ql-blank::before': {
            color: '#999',
            fontStyle: 'italic',
          }
        }}
      >
        <ReactQuill
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
          theme={theme}
          readOnly={readOnly}
        />
      </Paper>
    </Box>
  );
};