import type { LogicalCommandDefinition } from '../LogicalRules';
import { createTextareaLogicalCommandArgsField } from './shared';

export const ClearMeInterfaceCommandDefinition = {
  name: "clear-me-interface",
  label: "清空未使用ME接口配置",
  aliases: ["CMI"],
  category: "标记",
  description: "为剩余未使用的ME接口未设置槽标记为清除。",
  argsLabel: "",
  argsPlaceholder: "",
  argsHint: "",
  renderArgsField: () => (<></>)
} satisfies LogicalCommandDefinition;
