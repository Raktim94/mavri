import ClearIcon from '@mui/icons-material/Clear';
import { Box, IconButton, ListItemButton, ListItemText, Typography } from '@mui/material';
import { memo, type FC, type ReactNode } from 'react';

const LABEL_SX = {
  fontWeight: 600,
  color: 'primary.main',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const;

const VALUE_SX = {
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const;

interface FieldChipProps {
  label: string;
  icon?: ReactNode;
  value?: string;
  secondary?: ReactNode;
  required?: boolean;
  align?: 'start' | 'end';
  trailing?: ReactNode;
  fullWidth?: boolean;
  onEdit: () => void;
  onClear?: () => void;
  clearText?: string;
}

const FieldChipComponent: FC<FieldChipProps> = ({
  label,
  icon,
  value,
  secondary,
  required = false,
  align = 'start',
  trailing,
  fullWidth = false,
  onEdit,
  onClear,
  clearText
}) => {
  const secondaryNode =
    secondary !== undefined ? (
      secondary
    ) : value ? (
      <Typography component="div" variant="body2" sx={VALUE_SX}>
        {value}
      </Typography>
    ) : undefined;

  return (
    <Box sx={{ width: fullWidth ? '100%' : 'fit-content' }}>
      <ListItemButton onClick={onEdit} sx={{ pt: 2, pb: 2, pl: 2, pr: onClear ? 1.5 : 2, borderRadius: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', gap: 1 }}>
          <ListItemText
            primary={
              <Typography
                component="div"
                variant="body1"
                sx={{
                  ...LABEL_SX,
                  display: icon ? 'flex' : undefined,
                  justifyContent: icon ? 'center' : undefined,
                  flexDirection: icon ? 'row' : undefined
                }}
              >
                {icon}
                {label.toUpperCase()}
                {required ? ' *' : ''}
              </Typography>
            }
            secondary={secondaryNode}
            disableTypography
            sx={{ m: 0, textAlign: align }}
            slotProps={{ primary: { sx: { fontWeight: 500, m: 0 } } }}
          />
          {trailing}
          {value && onClear && clearText && (
            <IconButton
              edge="end"
              size="small"
              aria-label={clearText}
              onClick={event => {
                event.stopPropagation();
                onClear();
              }}
              sx={{ ml: 'auto' }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </ListItemButton>
    </Box>
  );
};

export const FieldChip = memo(FieldChipComponent);
