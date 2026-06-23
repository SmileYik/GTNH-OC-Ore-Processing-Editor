import type { LogicalCommandDefinition } from '../LogicalRules';
import { createFluidResourceComparisonLogicalCommandArgsField } from './resourceFields.fluid';

export const CheckFluidCommandDefinition = {
  name: "check-fluid",
  label: "检查流体数量",
  aliases: ["CF"],
  category: "检查",
  description: "读取 ME 网络中的流体数量，并按比较表达式返回 true / false。",
  argsLabel: "比较表达式",
  argsPlaceholder: "water >= 1000",
  argsHint: "",
  renderArgsField: createFluidResourceComparisonLogicalCommandArgsField(
    "比较表达式",
    "water",
    "输入流体文本值，例如 `steam`，也可以直接手动输入自定义文本。",
    "id"
  )
} satisfies LogicalCommandDefinition;
