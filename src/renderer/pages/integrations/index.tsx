import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PauseCircleOutlineOutlinedIcon from '@mui/icons-material/PauseCircleOutlineOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createEcommerceIntegration,
  deactivateEcommerceIntegration,
  deleteEcommerceIntegration,
  listEcommerceIntegrations,
  type EcommercePlatform,
  type PublicEcommerceIntegration
} from '../../shared/api/ecommerceApi';
import { useBusinessesRetrieve } from '../../shared/hooks/businesses/useBusinessesRetrieve';
import { useCurrenciesRetrieve } from '../../shared/hooks/currencies/useCurrenciesRetrieve';

const PLATFORM_LABEL: Record<EcommercePlatform, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  generic: 'Generic webhook'
};

export const IntegrationsPage: FC = () => {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState<PublicEcommerceIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<{ webhookUrl: string; webhookSecret: string; name: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    platform: 'shopify' as EcommercePlatform,
    businessId: '',
    currencyId: '',
    defaultTaxRate: '0',
    autoIssue: true
  });

  const { businesses } = useBusinessesRetrieve({ immediate: true });
  const { currencies } = useCurrenciesRetrieve({ immediate: true });

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listEcommerceIntegrations();
    if (result.success) setIntegrations(result.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleOpenDialog = useCallback(() => {
    setError(null);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim() || !form.businessId || !form.currencyId) {
      setError('common.fieldRequired');
      return;
    }
    setError(null);
    const result = await createEcommerceIntegration({
      name: form.name.trim(),
      platform: form.platform,
      businessId: Number(form.businessId),
      currencyId: Number(form.currencyId),
      defaultTaxRate: Number(form.defaultTaxRate) || 0,
      autoIssue: form.autoIssue
    });
    if (!result.success || !result.data) {
      setError(result.key ?? result.message ?? 'error.unknownError');
      return;
    }
    setJustCreated({
      name: result.data.integration.name,
      webhookUrl: result.data.webhookUrl,
      webhookSecret: result.data.webhookSecret
    });
    setDialogOpen(false);
    setForm({ name: '', platform: 'shopify', businessId: '', currencyId: '', defaultTaxRate: '0', autoIssue: true });
    refresh();
  }, [form, refresh]);

  const handleDeactivate = useCallback(
    async (id: number) => {
      await deactivateEcommerceIntegration(id);
      refresh();
    },
    [refresh]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await deleteEcommerceIntegration(id);
      refresh();
    },
    [refresh]
  );

  const copy = useCallback((value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorefrontIcon color="primary" />
          <Typography variant="h6">E-commerce integrations</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
          Connect a store
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary">
        Connect a Shopify or WooCommerce store (or any tool that can send a signed webhook) so new orders automatically
        become invoices here. Each store gets its own webhook URL and secret — put the secret in the store&apos;s
        webhook settings, never anywhere else.
      </Typography>

      {justCreated && (
        <Alert
          severity="success"
          onClose={() => setJustCreated(null)}
          sx={{ '& .MuiAlert-message': { width: '100%' } }}
        >
          <Typography variant="subtitle2" gutterBottom>
            &quot;{justCreated.name}&quot; connected — copy these now, the secret will not be shown again.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
              Webhook URL: {justCreated.webhookUrl}
            </Typography>
            <IconButton size="small" onClick={() => copy(justCreated.webhookUrl)}>
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
              Webhook secret: {justCreated.webhookSecret}
            </Typography>
            <IconButton size="small" onClick={() => copy(justCreated.webhookSecret)}>
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
          </Box>
        </Alert>
      )}

      <Divider />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'auto', flex: 1 }}>
        {!loading && integrations.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No stores connected yet.
          </Typography>
        )}
        {integrations.map(integration => (
          <Box
            key={integration.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 1.5
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="subtitle2">{integration.name}</Typography>
                <Chip size="small" label={PLATFORM_LABEL[integration.platform]} />
                {!integration.isActive && <Chip size="small" color="default" label="Inactive" variant="outlined" />}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                {integration.webhookUrl}
              </Typography>
              {integration.lastEventAt && (
                <Typography variant="caption" color="text.secondary">
                  Last order received: {new Date(integration.lastEventAt).toLocaleString()}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {integration.isActive && (
                <IconButton size="small" title="Deactivate" onClick={() => handleDeactivate(integration.id)}>
                  <PauseCircleOutlineOutlinedIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton size="small" title="Delete" onClick={() => handleDelete(integration.id)}>
                <DeleteOutlineOutlinedIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        ))}
      </Box>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Connect a store</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && <Alert severity="error">{t(error, { defaultValue: error })}</Alert>}
            <TextField
              label="Name"
              placeholder="e.g. My Shopify store"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="platform-label">Platform</InputLabel>
              <Select
                labelId="platform-label"
                label="Platform"
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value as EcommercePlatform }))}
              >
                <MenuItem value="shopify">Shopify</MenuItem>
                <MenuItem value="woocommerce">WooCommerce</MenuItem>
                <MenuItem value="generic">Generic webhook</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="business-label">Business</InputLabel>
              <Select
                labelId="business-label"
                label="Business"
                value={form.businessId}
                onChange={e => setForm(f => ({ ...f, businessId: e.target.value as string }))}
              >
                {businesses.map(b => (
                  <MenuItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="currency-label">Currency</InputLabel>
              <Select
                labelId="currency-label"
                label="Currency"
                value={form.currencyId}
                onChange={e => setForm(f => ({ ...f, currencyId: e.target.value as string }))}
              >
                {currencies.map(c => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Default tax rate (%)"
              type="number"
              value={form.defaultTaxRate}
              onChange={e => setForm(f => ({ ...f, defaultTaxRate: e.target.value }))}
              fullWidth
            />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">Issue invoices immediately (vs. draft/unpaid)</Typography>
              <Switch checked={form.autoIssue} onChange={e => setForm(f => ({ ...f, autoIssue: e.target.checked }))} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>
            Connect
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
