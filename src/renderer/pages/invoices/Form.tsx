import { memo, useCallback, useDeferredValue, useEffect, useRef, useState, useTransition, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { InvoiceFormMode } from '../../shared/enums/invoiceFormMode';
import { InvoiceType } from '../../shared/enums/invoiceType';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import { useStyleProfileAdd } from '../../shared/hooks/styleProfiles/useStyleProfileAdd';
import type { Invoice, InvoiceFromData } from '../../shared/types/invoice';
import type { Preset } from '../../shared/types/preset';
import type { Response } from '../../shared/types/response';
import type { StyleProfileAdd, StyleProfileFromData } from '../../shared/types/styleProfiles';
import { useAppDispatch } from '../../state/configureStore';
import { addToast } from '../../state/pageSlice';
import { InvoiceForm } from './Form/index';
import { isDraftSubmittable, mergePresetIntoDraft, newDraftFor, withSavedStyleProfileId } from './Form/invoiceDraft';
import { InvoicesPreview } from './Preview';

interface Props {
  invoice?: Invoice;
  type: InvoiceType;
  mode: InvoiceFormMode;
  handleChange?: (data: { invoice: InvoiceFromData; isFormValid: boolean; description?: string }) => void;
  handleDelete?: (id: number) => void;
  handleDuplicate?: (id: number, invoiceType: InvoiceType) => void;
  preset?: Preset;
}

const CHANGE_DEBOUNCE_MS = 250;

const InvoiceEditorFrame: FC<Props> = ({
  type,
  mode,
  handleChange = () => {},
  invoice,
  handleDelete = () => {},
  handleDuplicate = () => {},
  preset
}) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [, startTransition] = useTransition();

  const [draft, setDraft] = useState<InvoiceFromData | undefined>(undefined);
  const [isValid, setIsValid] = useState(false);
  const baselineRef = useRef<InvoiceFromData | undefined>(undefined);
  const debounceRef = useRef<number | undefined>(undefined);

  const [pendingProfile, setPendingProfile] = useState<StyleProfileAdd | undefined>(undefined);
  const { execute: saveStyleProfile, data: savedProfile } = useStyleProfileAdd({
    styleProfile: pendingProfile,
    immediate: false,
    onDone: (data: Response<StyleProfileAdd>) => {
      setPendingProfile(undefined);

      if (!data.success) {
        if (data.message) {
          const message = i18n.exists(data.message) ? t(data.message) : data.message;
          dispatch(addToast({ message, severity: 'error' }));
        } else if (data.key) {
          dispatch(addToast({ message: t(data.key), severity: 'error' }));
        }
      }
    }
  });

  useFormDirtyCheck(draft, baselineRef);

  useEffect(() => {
    startTransition(() => {
      const initial = invoice ? { ...invoice } : newDraftFor(type);
      baselineRef.current = initial;
      setDraft(initial);
    });
  }, [invoice, type, startTransition]);

  useEffect(() => {
    if (!preset) return;

    startTransition(() => {
      setDraft(current => (current ? mergePresetIntoDraft(current, preset) : current));
    });
  }, [preset, startTransition]);

  useEffect(() => {
    if (!pendingProfile || !savedProfile || !draft) return;

    setDraft(withSavedStyleProfileId(draft, savedProfile));
  }, [pendingProfile, savedProfile, draft]);

  useEffect(() => {
    setIsValid(isDraftSubmittable(draft));
  }, [draft]);

  useEffect(() => {
    if (pendingProfile !== undefined) saveStyleProfile();
  }, [pendingProfile, saveStyleProfile]);

  useEffect(() => {
    if (!draft) return;

    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      handleChange({
        invoice: draft,
        isFormValid: isValid,
        description: draft.layoutId == null ? t('common.layoutRequired') : t('common.invalidForm')
      });
    }, CHANGE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    };
  }, [draft, isValid, t, handleChange]);

  const deferredDraft = useDeferredValue(draft);

  const saveProfile = useCallback((profile: StyleProfileFromData) => setPendingProfile(profile), []);

  if (mode === InvoiceFormMode.edit) {
    return (
      <InvoiceForm
        type={type}
        setInvoiceForm={setDraft}
        invoiceForm={deferredDraft}
        handleDelete={handleDelete}
        handleDuplicate={handleDuplicate}
      />
    );
  }

  return <InvoicesPreview setInvoiceForm={setDraft} invoiceForm={deferredDraft} onSaveProfile={saveProfile} />;
};

export const Form = memo(InvoiceEditorFrame);
