import type { LogicalCommandDefinition } from '../LogicalRules';
import { createInputLogicalCommandArgsField } from './shared';

export const CheckItemLabelCommandDefinition = {
  name: "check-item-label",
  label: "检查物品名",
  aliases: ["CIL"],
  category: "检查",
  description: "读取指定物品名称在 ME 网络中的总数量，并按比较表达式返回 true / false。",
  argsLabel: "比较表达式",
  argsPlaceholder: "Iron Ingot >= 32",
  argsHint: "格式类似 `物品名 >= 数字`，例如 `Iron Ingot >= 32`。",
  renderArgsField: createInputLogicalCommandArgsField(
    "比较表达式",
    "Iron Ingot >= 32",
    "格式类似 `物品名 >= 数字`，例如 `Iron Ingot >= 32`。"
  )
} satisfies LogicalCommandDefinition;
