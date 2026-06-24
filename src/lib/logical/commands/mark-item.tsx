import type { LogicalCommandDefinition } from '../LogicalRules';
import { ITEM_RESOURCE_PICKER_SPEC } from '../../../components/resourcePicker';
import { createResourceSelectorLogicalCommandArgsField } from '../resourceFields';

export const MarkItemCommandDefinition = {
  name: "mark-item",
  label: "标记物品 ID",
  aliases: ["MI"],
  category: "标记",
  description: "把指定物品文本值加入缓存中的 markedItems，后续交给筛选流程使用。",
  argsLabel: "物品 ID",
  argsPlaceholder: "minecraft:stone:0",
  argsHint: "",
  renderArgsField: createResourceSelectorLogicalCommandArgsField(
    ITEM_RESOURCE_PICKER_SPEC,
    "物品 ID",
    "minecraft:stone:0",
    "输入物品ID，或使用右侧按钮从数据库中选择。"
  )
} satisfies LogicalCommandDefinition;
