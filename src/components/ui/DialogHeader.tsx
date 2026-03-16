import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface DialogHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** gradient CSS string — e.g. 'linear-gradient(145deg, #3A56A8, #28A8E2)' */
  iconGradient?: string;
  iconGlow?: string;
  badge?: React.ReactNode;
  onClose?: () => void;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({
  title,
  subtitle,
  icon,
  iconGradient = 'linear-gradient(145deg, #3A56A8 0%, #28A8E2 100%)',
  iconGlow = 'rgba(58,86,168,0.25)',
  badge,
  onClose,
}) => (
  <Box
    sx={{
      display:        'flex',
      alignItems:     'flex-start',
      justifyContent: 'space-between',
      px:             2.5,
      pt:             2,
      pb:             1.75,
      borderBottom:   '1px solid rgba(58,86,168,0.08)',
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
      {icon && (
        /* macOS 26-style liquid glass icon badge */
        <Box
          sx={{
            width:          36,
            height:         36,
            borderRadius:   '10px',
            background:     iconGradient,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            position:       'relative',
            overflow:       'hidden',
            flexShrink:     0,
            boxShadow:      `0 4px 14px ${iconGlow}, 0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.32)`,
            // specular top highlight
            '&::before': {
              content:      '""',
              position:     'absolute',
              top:          0, left: 0, right: 0,
              height:       '44%',
              background:   'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%)',
              borderRadius: '10px 10px 60% 60%',
              pointerEvents:'none',
              zIndex:        1,
            },
            // rim shadow
            '&::after': {
              content:   '""',
              position:  'absolute',
              bottom:    0, left: 0, right: 0,
              height:    '26%',
              background:'linear-gradient(0deg, rgba(0,0,0,0.18) 0%, transparent 100%)',
              borderRadius:'0 0 10px 10px',
              pointerEvents:'none',
              zIndex:    1,
            },
            // icon child gets white color + z-index
            '& > *': {
              position: 'relative',
              zIndex:   2,
              color:    'rgba(255,255,255,0.96) !important',
              filter:   'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
              fontSize: '18px !important',
            },
          }}
        >
          {icon}
        </Box>
      )}

      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{
            fontSize:   '14.5px',
            fontWeight: 600,
            color:      '#1A2440',
            lineHeight: 1.3,
            fontFamily: '"Inter", sans-serif',
            letterSpacing: '-0.1px',
          }}>
            {title}
          </Typography>
          {badge}
        </Box>
        {subtitle && (
          <Typography sx={{
            fontSize:     '12px',
            color:        '#6B7A99',
            mt:           0.3,
            lineHeight:   1.4,
            fontFamily:   '"Inter", sans-serif',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>

    {onClose && (
      <IconButton
        size="small"
        onClick={onClose}
        sx={{
          ml:           1,
          mt:          -0.25,
          flexShrink:   0,
          width:        28,
          height:       28,
          borderRadius: '8px',
          color:        '#8A99B8',
          '&:hover': {
            bgcolor: 'rgba(58,86,168,0.07)',
            color:   '#3A4D72',
          },
          transition: 'all 0.15s ease',
        }}
      >
        <CloseIcon sx={{ fontSize: 15 }} />
      </IconButton>
    )}
  </Box>
);
