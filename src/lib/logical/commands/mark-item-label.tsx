import type { LogicalCommandDefinition } from '../LogicalRules';
import { createInputLogicalCommandArgsField } from './shared';

export const MarkItemLabelCommandDefinition = {
  name: "mark-item-label",
  label: "标记物品名",
  aliases: ["MIL"],
  category: "标记",
  description: "把指定物品名称加入缓存中的 markedItems，后续交给筛选流程使用。",
  argsLabel: "物品名",
  argsPlaceholder: "Iron Ingot",
  argsHint: "输入需要标记的物品名称，支持在同一名称下匹配多个物品。",
  renderArgsField: createInputLogicalCommandArgsField(
    "物品名",
    "Iron Ingot",
    "输入需要标记的物品名称，支持在同一名称下匹配多个物品。"
  )
} satisfies LogicalCommandDefinition;
