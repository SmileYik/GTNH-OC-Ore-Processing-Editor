import type { LogicalCommandDefinition } from '../LogicalRules';
import { createInputLogicalCommandArgsField } from './shared';

export const PrintCommandDefinition = {
  name: "print",
  label: "打印日志",
  aliases: ["P"],
  category: "调试",
  description: "打印一条消息到终端并返回 true。",
  argsLabel: "日志内容",
  argsPlaceholder: "hello world",
  argsHint: "适合调试表达式执行路径，参数会原样打印。",
  renderArgsField: createInputLogicalCommandArgsField(
    "日志内容",
    "hello world",
    "适合调试表达式执行路径，参数会原样打印。"
  )
} satisfies LogicalCommandDefinition;
