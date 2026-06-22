import type { LogicalCommandDefinition } from '../LogicalRules';
import { createInputLogicalCommandArgsField } from './shared';

export const CheckItemCommandDefinition = {
  name: "check-item",
  label: "检查物品 ID",
  aliases: ["CI"],
  category: "检查",
  description: "读取指定物品 ID 在 ME 网络中的总数量，并按比较表达式返回 true / false。",
  argsLabel: "比较表达式",
  argsPlaceholder: "minecraft:stone#0 >= 64",
  argsHint: "格式类似 `物品ID >= 数字`，例如 `gregtech:gt.comb#25 > 0`。",
  renderArgsField: createInputLogicalCommandArgsField(
    "比较表达式",
    "minecraft:stone#0 >= 64",
    "格式类似 `物品ID >= 数字`，例如 `gregtech:gt.comb#25 > 0`。"
  )
} satisfies LogicalCommandDefinition;
