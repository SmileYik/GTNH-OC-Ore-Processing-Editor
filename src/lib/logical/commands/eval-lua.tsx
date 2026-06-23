import type { LogicalCommandDefinition } from '../LogicalRules';
import { createTextareaLogicalCommandArgsField } from './shared';

export const EvalLuaCommandDefinition = {
  name: "eval-lua",
  label: "执行 Lua",
  aliases: ["L"],
  category: "脚本",
  description: "执行一段 Lua 代码，可直接读取 cache 并决定返回 true / false。",
  argsLabel: "Lua 代码",
  argsPlaceholder: "return cache.count > 0",
  argsHint: "代码可以访问 cache 变量，适合高级自定义逻辑。",
  renderArgsField: createTextareaLogicalCommandArgsField(
    "Lua 代码",
    "return cache.count > 0",
    "代码会在 sandbox 环境中执行，适合高级自定义逻辑。"
  )
} satisfies LogicalCommandDefinition;
