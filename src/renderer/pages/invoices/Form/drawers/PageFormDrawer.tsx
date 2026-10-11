import { Box, SwipeableDrawer } from '@mui/material';
import { memo, type FC, type ReactNode } from 'react';
import { PageHeader } from '../../../../shared/components/layout/pageHeader/PageHeader';
import { drawerPaperSx, useIsDesktop } from './drawerSx';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  title: string;
  formData: unknown;
  isFormValid: boolean;
  onSave: (data: unknown) => void;
  onCloseClick?: () => void;
  renderCustomButtons?: () => ReactNode;
  height: string;
  mobileHeight?: string;
  children: ReactNode;
}

const PageFormDrawerComponent: FC<Props> = ({
  isOpen,
  onClose,
  onOpen,
  title,
  formData,
  isFormValid,
  onSave,
  onCloseClick,
  renderCustomButtons,
  height,
  mobileHeight,
  children
}) => {
  const isDesktop = useIsDesktop();

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={() => onClose?.()}
      onOpen={() => onOpen?.()}
      slotProps={{ paper: { sx: drawerPaperSx({ isDesktop, height, mobileHeight }) } }}
    >
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title={title}
          showBack={false}
          showSave={true}
          showClose={false}
          formData={formData}
          isFormValid={isFormValid}
          onClose={onCloseClick ?? onClose}
          onSave={onSave}
          renderCustomButtons={renderCustomButtons}
        />
      </Box>
      {children}
    </SwipeableDrawer>
  );
};

export const PageFormDrawer = memo(PageFormDrawerComponent);
