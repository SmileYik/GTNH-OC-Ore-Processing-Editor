import type { LogicalCommandDefinition } from '../LogicalRules';
import { createInputLogicalCommandArgsField } from './shared';

export const CheckFluidCommandDefinition = {
  name: "check-fluid",
  label: "检查液体",
  aliases: ["CF"],
  category: "检查",
  description: "读取 ME 网络中的液体数量，并按比较表达式返回 true / false。",
  argsLabel: "比较表达式",
  argsPlaceholder: "water >= 1000",
  argsHint: "格式类似 `液体名 >= 数字`，例如 `steam > 4000`。",
  renderArgsField: createInputLogicalCommandArgsField(
    "比较表达式",
    "water >= 1000",
    "格式类似 `液体名 >= 数字`，例如 `steam > 4000`。"
  )
} satisfies LogicalCommandDefinition;
