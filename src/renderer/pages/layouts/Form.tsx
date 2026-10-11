import Editor, { loader } from '@monaco-editor/react';
import { Button, FormControlLabel, Grid, Switch, Typography, useTheme } from '@mui/material';
import * as monaco from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import { parseLayoutSchema, type Layout, type LayoutAdd, type LayoutFormData } from '../../shared/types/layouts';
import '../../shared/utils/monacoEnvironment';
import { buildLayoutDraftChange, formatLayoutSchemaText } from './layoutsModel';

loader.config({ monaco });

interface Props {
  item?: Layout;
  handleChange: (value: { layout: LayoutAdd; isFormValid: boolean; description: string }) => void;
}

export const Form = ({ item, handleChange }: Props) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const emitRef = useRef(handleChange);
  const translateRef = useRef(t);
  const baselineRef = useRef<LayoutFormData | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { form, setForm, update } = useForm<LayoutFormData>({
    id: item?.id,
    schema: formatLayoutSchemaText(item?.schema),
    isArchived: item?.isArchived ?? false
  });
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>();
  const parsedSchema = parseLayoutSchema(form.schema);
  const hasSchemaText = form.schema.trim() !== '';

  useEffect(() => {
    emitRef.current = handleChange;
    translateRef.current = t;
  }, [handleChange, t]);

  useFormDirtyCheck(form, baselineRef);

  useEffect(() => {
    const next: LayoutFormData = {
      id: item?.id,
      schema: formatLayoutSchemaText(item?.schema),
      isArchived: item?.isArchived ?? false
    };
    baselineRef.current = next;
    setUploadFailures([]);
    setForm(next);
  }, [item, setForm]);

  useEffect(() => {
    emitRef.current(
      buildLayoutDraftChange({
        id: item?.id,
        schemaText: form.schema,
        isArchived: form.isArchived,
        translate: translateRef.current
      })
    );
  }, [form, hasSchemaText, item?.id]);

  useEffect(() => {
    if (!editor) return;

    const frame = requestAnimationFrame(() => editor.layout());
    const delayed = window.setTimeout(() => editor.layout(), 300);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(delayed);
    };
  }, [editor]);

  const handleSchemaFile = async (file: File) => {
    const text = await file.text();
    const result = parseLayoutSchema(text);
    if (result.errors.length) {
      setUploadFailures(result.errors.map(error => `${error.path}: ${t(error.message, error.params)}`));
    } else {
      setUploadFailures([]);
      update('schema', JSON.stringify(result.schema, null, 2));
    }
  };

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async event => {
            const file = event.target.files?.[0];
            if (file) await handleSchemaFile(file);
            event.target.value = '';
          }}
        />
        <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
          {t('layouts.uploadSchema')}
        </Button>
      </Grid>
      {uploadFailures.length > 0 && (
        <Grid size={12}>
          {uploadFailures.map(failure => (
            <Typography key={failure} color="error" variant="caption" sx={{ display: 'block' }}>
              {failure}
            </Typography>
          ))}
        </Grid>
      )}
      <Grid size={12}>
        <Editor
          onMount={setEditor}
          height="600px"
          defaultLanguage="json"
          theme={theme.palette.mode === 'dark' ? 'vs-dark' : 'vs'}
          value={form.schema}
          options={{
            automaticLayout: false,
            fontSize: 14,
            minimap: { enabled: false },
            readOnly: true,
            readOnlyMessage: { value: t('layouts.readOnlySchema') },
            scrollBeyondLastLine: false,
            tabSize: 2
          }}
        />
        {hasSchemaText &&
          parsedSchema.errors.map(error => (
            <Typography
              key={`${error.path}-${error.message}`}
              color="error"
              variant="caption"
              sx={{ display: 'block' }}
            >
              {error.path}: {t(error.message, error.params)}
            </Typography>
          ))}
      </Grid>
      <Grid size={{ xs: 12, md: 12 }}>
        <FormControlLabel
          control={<Switch checked={form.isArchived} onChange={e => update('isArchived', e.target.checked)} />}
          label={t('common.archived')}
        />
      </Grid>
    </Grid>
  );
};
