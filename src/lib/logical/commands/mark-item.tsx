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
  argsHint: "输入一个物品文本值，数据库只作辅助查询；如果没有命中，也可以直接手动填写。",
  renderArgsField: createItemResourceSelectorLogicalCommandArgsField(
    "物品 ID",
    "minecraft:stone:0",
    "输入物品文本值，或使用右侧按钮从数据库中选择。"
  )
} satisfies LogicalCommandDefinition;
