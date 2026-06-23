import type { LogicalCommandDefinition } from '../LogicalRules';
import { CheckFluidCommandDefinition } from './check-fluid';
import { CheckItemCommandDefinition } from './check-item';
import { CheckItemLabelCommandDefinition } from './check-item-label';
import { MarkFluidCommandDefinition } from './mark-fluid';
import { MarkItemCommandDefinition } from './mark-item';
import { MarkItemLabelCommandDefinition } from './mark-item-label';
import { PrintCommandDefinition } from './print';
import { EvalLuaCommandDefinition } from './eval-lua';

export {
  CheckFluidCommandDefinition,
  CheckItemCommandDefinition,
  CheckItemLabelCommandDefinition,
  MarkFluidCommandDefinition,
  MarkItemCommandDefinition,
  MarkItemLabelCommandDefinition,
  PrintCommandDefinition,
  EvalLuaCommandDefinition
};

export const LOGICAL_COMMAND_DEFINITIONS = [
  CheckFluidCommandDefinition,
  CheckItemCommandDefinition,
  CheckItemLabelCommandDefinition,
  MarkFluidCommandDefinition,
  MarkItemCommandDefinition,
  MarkItemLabelCommandDefinition,
  PrintCommandDefinition,
  EvalLuaCommandDefinition
] satisfies LogicalCommandDefinition[];
