import type { LogicalCommandDefinition } from '../LogicalRules';
import { FLUID_RESOURCE_PICKER_SPEC } from '../../../components/resourcePicker';
import { createResourceSelectorLogicalCommandArgsField } from '../resourceFields';

export const MarkFluidCommandDefinition = {
  name: 'mark-fluid',
  label: '标记流体',
  aliases: ['MF'],
  category: '标记',
  description: '将该流体标记到 cache 中。',
  argsLabel: '流体',
  argsPlaceholder: 'water',
  argsHint: '',
  renderArgsField: createResourceSelectorLogicalCommandArgsField(
    FLUID_RESOURCE_PICKER_SPEC,
    '流体',
    'water',
    '输入流体的ID，或使用右侧按钮从数据库中选择。'
  )
} satisfies LogicalCommandDefinition;
