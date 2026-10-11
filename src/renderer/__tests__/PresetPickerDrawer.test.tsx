import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { PresetPickerDrawer } from '../pages/invoices/list/PresetPickerDrawer';
import type { Preset } from '../shared/types/preset';

const presets: Preset[] = [
  { id: 1, name: 'Monthly retainer', isArchived: false, createdAt: '', updatedAt: '' },
  { id: 2, name: 'One-off job', isArchived: false, createdAt: '', updatedAt: '' }
] as Preset[];

const retrieveMock = vi.fn();

vi.mock('../shared/hooks/presets/usePresetsRetrieve', () => ({
  usePresetsRetrieve: (args: { onDone?: (data: unknown) => void }) => {
    retrieveMock(args);
    return { presets, execute: vi.fn() };
  }
}));

vi.mock('../state/configureStore', () => ({
  useAppDispatch: () => vi.fn()
}));

vi.mock('../state/pageSlice', () => ({
  addToast: (toast: unknown) => toast
}));

const renderDrawer = (props: Partial<React.ComponentProps<typeof PresetPickerDrawer>> = {}) => {
  const handlers = {
    onCreateBlank: vi.fn(),
    onCreateFromPreset: vi.fn(),
    onCloseDrawer: vi.fn()
  };

  render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <PresetPickerDrawer open {...handlers} {...props} />
      </I18nextProvider>
    </MemoryRouter>
  );

  return handlers;
};

describe('PresetPickerDrawer', () => {
  beforeEach(() => {
    retrieveMock.mockClear();
  });

  it('offers a blank document and one row per preset', () => {
    renderDrawer();

    expect(screen.getByText('Create new')).toBeTruthy();
    expect(screen.getByText("Create new from preset 'Monthly retainer'")).toBeTruthy();
    expect(screen.getByText("Create new from preset 'One-off job'")).toBeTruthy();
  });

  it('creates a blank document when asked', () => {
    const { onCreateBlank } = renderDrawer();

    fireEvent.click(screen.getByText('Create new'));

    expect(onCreateBlank).toHaveBeenCalledTimes(1);
  });

  it('creates from the chosen preset', () => {
    const { onCreateFromPreset } = renderDrawer();

    fireEvent.click(screen.getByText("Create new from preset 'One-off job'"));

    expect(onCreateFromPreset).toHaveBeenCalledTimes(1);
    expect(onCreateFromPreset).toHaveBeenCalledWith(presets[1]);
  });

  it('narrows the preset list as the search changes', () => {
    renderDrawer();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'retainer' } });

    expect(screen.getByText("Create new from preset 'Monthly retainer'")).toBeTruthy();
    expect(screen.queryByText("Create new from preset 'One-off job'")).toBeNull();
  });
});
