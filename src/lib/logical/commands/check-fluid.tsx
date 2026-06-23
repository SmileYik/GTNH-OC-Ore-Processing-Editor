import type { LogicalCommandDefinition } from '../LogicalRules';
import { createFluidResourceComparisonLogicalCommandArgsField } from './resourceFields.fluid';

export const CheckFluidCommandDefinition = {
  name: "check-fluid",
  label: "检查液体",
  aliases: ["CF"],
  category: "检查",
  description: "读取 ME 网络中的液体数量，并按比较表达式返回 true / false。",
  argsLabel: "比较表达式",
  argsPlaceholder: "water >= 1000",
  argsHint: "输入一个流体文本值，再选择比较符号和数量；数据库只负责辅助补全，不要求一定命中。",
  renderArgsField: createFluidResourceComparisonLogicalCommandArgsField(
    "比较表达式",
    "water",
    "输入流体文本值，例如 `steam`，也可以直接手动输入自定义文本。",
    "id"
  )
} satisfies LogicalCommandDefinition;
