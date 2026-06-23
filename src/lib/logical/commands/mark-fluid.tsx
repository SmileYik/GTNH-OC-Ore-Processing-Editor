import type { LogicalCommandDefinition } from '../LogicalRules';
import { createFluidResourceSelectorLogicalCommandArgsField } from './resourceFields.fluid';

export const MarkFluidCommandDefinition = {
  name: 'mark-fluid',
  label: '标记流体',
  aliases: ['MF'],
  category: '标记',
  description: '将该流体标记到 cache 中。',
  argsLabel: '流体',
  argsPlaceholder: 'water',
  argsHint: '',
  renderArgsField: createFluidResourceSelectorLogicalCommandArgsField(
    '流体',
    'water',
    '输入流体的ID，或使用右侧按钮从数据库中选择。'
  )
} satisfies LogicalCommandDefinition;
