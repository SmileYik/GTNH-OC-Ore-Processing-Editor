import type { LogicalCommandDefinition } from '../LogicalRules';
import { createInputLogicalCommandArgsField } from './shared';

export const MarkItemCommandDefinition = {
  name: "mark-item",
  label: "标记物品 ID",
  aliases: ["MI"],
  category: "标记",
  description: "把指定物品 ID 加入缓存中的 markedItems，后续交给筛选流程使用。",
  argsLabel: "物品 ID",
  argsPlaceholder: "minecraft:stone#0",
  argsHint: "输入需要标记的物品 ID，执行器会直接调用 ItemUtil 解析。",
  renderArgsField: createInputLogicalCommandArgsField(
    "物品 ID",
    "minecraft:stone#0",
    "输入需要标记的物品 ID，执行器会直接调用 ItemUtil 解析。"
  )
} satisfies LogicalCommandDefinition;
