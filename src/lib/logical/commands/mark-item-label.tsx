import type { LogicalCommandDefinition } from '../LogicalRules';
import { createItemResourceSelectorLogicalCommandArgsField } from './resourceFields.item';

export const MarkItemLabelCommandDefinition = {
  name: "mark-item-label",
  label: "标记物品名",
  aliases: ["MIL"],
  category: "标记",
  description: "把指定物品名称文本值加入缓存中的 markedItems 数组表中，后续交给筛选流程使用。",
  argsLabel: "物品名",
  argsPlaceholder: "Iron Ingot",
  argsHint: "",
  renderArgsField: createItemResourceSelectorLogicalCommandArgsField(
    "物品名",
    "Iron Ingot",
    "输入物品名称文本值，或使用右侧按钮从数据库中选择。",
    "label"
  )
} satisfies LogicalCommandDefinition;
