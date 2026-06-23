import type { LogicalCommandDefinition } from '../LogicalRules';
import { createItemResourceComparisonLogicalCommandArgsField } from './resourceFields.item';

export const CheckItemCommandDefinition = {
  name: "check-item",
  label: "检查物品 ID",
  aliases: ["CI"],
  category: "检查",
  description: "读取指定物品 ID 在 ME 网络中的总数量，并按比较表达式返回 true / false。",
  argsLabel: "比较表达式",
  argsPlaceholder: "minecraft:stone:0 >= 64",
  argsHint: "输入一个物品文本值，再选择比较符号和数量；数据库只负责辅助补全，不要求一定命中。",
  renderArgsField: createItemResourceComparisonLogicalCommandArgsField(
    "比较表达式",
    "minecraft:stone:0",
    "输入物品文本值，例如 `minecraft:stone:0`，也可以直接手动输入自定义文本。",
    "id"
  )
} satisfies LogicalCommandDefinition;
