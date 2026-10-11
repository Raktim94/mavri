import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../shared/enums/filterType';
import { usePresetAdd } from '../../shared/hooks/presets/usePresetAdd';
import { usePresetAddBatch } from '../../shared/hooks/presets/usePresetAddBatch';
import { usePresetDelete } from '../../shared/hooks/presets/usePresetDelete';
import { usePresetsRetrieve } from '../../shared/hooks/presets/usePresetsRetrieve';
import { usePresetUpdate } from '../../shared/hooks/presets/usePresetUpdate';
import type { Filter, FilterData } from '../../shared/types/filter';
import type { Preset, PresetAdd, PresetUpdate } from '../../shared/types/preset';
import type { Response } from '../../shared/types/response';
import { createCommonFilters } from '../../shared/utils/filterSortFunctions';
import { isPresetFromData } from '../../shared/utils/typeGuardFunctions';
import { Form } from './Form';
import { List } from './List';
import { PRESET_EXCEL_COLUMNS, PRESET_EXCEL_TEMPLATE } from './presetModel';

export const PresetsPage: FC = () => {
  const { t } = useTranslation();

  const filters: Filter[] = [...createCommonFilters({ t, namespace: 'presets', initial: FilterType.active })];

  const usePresetList = (args: { filter?: FilterData[]; onDone?: (data: Response<Preset[]>) => void }) => {
    const { presets, execute } = usePresetsRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: presets, execute };
  };

  const usePresetCreate = (args: {
    item?: PresetAdd;
    immediate?: boolean;
    onDone?: (data: Response<Preset>) => void;
  }) => usePresetAdd({ preset: args.item, immediate: args.immediate, onDone: args.onDone });

  const usePresetCreateBatch = (args: {
    item?: PresetAdd[];
    immediate?: boolean;
    onDone?: (data: Response<PresetAdd[]>) => void;
  }) => usePresetAddBatch({ presets: args.item, immediate: args.immediate, onDone: args.onDone });

  const usePresetEdit = (args: {
    item?: PresetUpdate;
    immediate?: boolean;
    onDone?: (data: Response<Preset>) => void;
  }) => usePresetUpdate({ preset: args.item, immediate: args.immediate, onDone: args.onDone });

  return (
    <CRUDPage<Preset, PresetAdd, PresetUpdate>
      componentId="presets"
      title={t('common.presets')}
      filters={filters}
      excelData={{
        excelColumns: PRESET_EXCEL_COLUMNS,
        excelFileName: 'presets',
        excelFormat: 'xlsx',
        excelTemplateData: PRESET_EXCEL_TEMPLATE
      }}
      useRetrieve={usePresetList}
      useAdd={usePresetCreate}
      useAddBatch={usePresetCreateBatch}
      useUpdate={usePresetEdit}
      useDelete={usePresetDelete}
      searchField="name"
      inlineOnAdd={true}
      sortOptions={[
        { label: t('common.name'), value: 'name' },
        { label: t('common.lastUpdate'), value: 'updatedAt' }
      ]}
      noItemButtonText={t('presets.add')}
      noItemText={t('presets.noItem')}
      leftTitle={t('menuItems.presets')}
      validateAndNormalize={async data => (isPresetFromData(data) ? data : undefined)}
      renderListItem={(item, selectedItem, onEdit, onDelete) => (
        <List
          key={item.id}
          item={item}
          selectedItem={selectedItem}
          onEdit={(editItem: Preset) => onEdit(editItem)}
          onDelete={(id: number) => onDelete(id)}
        />
      )}
      form={({ item, onChange }) => (
        <Form
          preset={item}
          handleChange={change => {
            if (isPresetFromData(change.preset)) {
              onChange({
                changedData: change.preset,
                isFormValid: change.isFormValid,
                description: change.description
              });
            }
          }}
        />
      )}
    />
  );
};
