import type { LogicalCommandDefinition } from '../LogicalRules';
import { createItemResourceComparisonLogicalCommandArgsField } from './resourceFields.item';

export const CheckItemLabelCommandDefinition = {
  name: "check-item-label",
  label: "检查物品名",
  aliases: ["CIL"],
  category: "检查",
  description: "读取指定物品名称在 ME 网络中的总数量，并按比较表达式返回 true / false。",
  argsLabel: "比较表达式",
  argsPlaceholder: "Iron Ingot >= 32",
  argsHint: "",
  renderArgsField: createItemResourceComparisonLogicalCommandArgsField(
    "比较表达式",
    "Iron Ingot",
    "输入物品名称文本值，例如 `Iron Ingot`，也可以直接手动输入自定义文本。",
    "label"
  )
} satisfies LogicalCommandDefinition;
