import type { LogicalCommandDefinition } from '../LogicalRules';
import { createFluidResourceSelectorLogicalCommandArgsField } from './resourceFields.fluid';

export const MarkFluidCommandDefinition = {
  name: 'mark-fluid',
  label: '标记液体',
  aliases: ['MF'],
  category: '标记',
  description: '把指定的液体文本值加入缓存，后续流程可以直接复用这段单一文本。',
  argsLabel: '流体',
  argsPlaceholder: 'water',
  argsHint: '输入一个流体文本值，数据库仅作辅助查询；如果没有命中，也可以直接手动填写。',
  renderArgsField: createFluidResourceSelectorLogicalCommandArgsField(
    '流体',
    'water',
    '输入流体文本值，或使用右侧按钮从数据库中选择。'
  )
} satisfies LogicalCommandDefinition;
