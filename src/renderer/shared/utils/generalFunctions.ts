const TAB_ID_PREFIX = 'mui-tab';
const TAB_PANEL_ID_PREFIX = 'mui-tabpanel';

export const a11yProps = (index: number) => ({
  id: `${TAB_ID_PREFIX}-${index}`,
  'aria-controls': `${TAB_PANEL_ID_PREFIX}-${index}`
});
