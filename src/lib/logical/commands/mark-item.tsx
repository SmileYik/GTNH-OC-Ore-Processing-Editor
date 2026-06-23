import type { LogicalCommandDefinition } from '../LogicalRules';
import { createItemResourceSelectorLogicalCommandArgsField } from './resourceFields.item';

export const MarkItemCommandDefinition = {
  name: "mark-item",
  label: "标记物品 ID",
  aliases: ["MI"],
  category: "标记",
  description: "把指定物品文本值加入缓存中的 markedItems，后续交给筛选流程使用。",
  argsLabel: "物品 ID",
  argsPlaceholder: "minecraft:stone:0",
  argsHint: "",
  renderArgsField: createItemResourceSelectorLogicalCommandArgsField(
    "物品 ID",
    "minecraft:stone:0",
    "输入物品ID，或使用右侧按钮从数据库中选择。"
  )
} satisfies LogicalCommandDefinition;
