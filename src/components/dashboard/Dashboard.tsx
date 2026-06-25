import { Config } from '../../config';
import type { OreConfig } from '../../lib/OreConfig';
import type { FilterGroup, InterfaceEntry, MineralProcess, ProcessReverseGroup, RoleEntry } from '../../lib/OreConfigManager';
import { ExportSection } from './ExportSection';
import { FilterListCard } from './FilterListCard';
import { InterfaceSection } from './InterfaceSection';
import { MineralProcessSection } from './MineralProcessSection';
import { ProcessReverseSection } from './ProcessReverseSection';
import { RoleSection } from './RoleSection';

interface DashboardProps {
  processes: MineralProcess[]; 
  onAddProcess: () => void;
  onEditProcess: (process: MineralProcess) => void;
  onDeleteProcess: (mineral: string) => void;
  reverseGroups: ProcessReverseGroup[];
  onReuseProcess: (steps: string[]) => void;
  roles: RoleEntry[];
  interfaces: InterfaceEntry[];
  roleNames: string[];
  onAddRole: () => void;
  onAddInterface: () => void;
  onEditRole: (role: RoleEntry) => void;
  onDeleteRole: (name: string) => void;
  onEditInterface: (entry: InterfaceEntry) => void;
  onDeleteInterface: (id: string) => void;
  idWhitelist: FilterGroup[];
  idBlacklist: FilterGroup[];
  logicalRules: FilterGroup[];
  onEditWhitelist: () => void;
  onEditBlacklist: () => void;
  onEditLogicalRules: () => void;
  config: OreConfig;
  fileName: string;
  userConfig: Config;
}

export function Dashboard({
  processes,
  onAddProcess,
  onEditProcess,
  onDeleteProcess,
  reverseGroups,
  onReuseProcess,
  roles,
  interfaces,
  roleNames,
  onAddRole,
  onAddInterface,
  onEditRole,
  onDeleteRole,
  onEditInterface,
  onDeleteInterface,
  idWhitelist,
  idBlacklist,
  logicalRules,
  onEditWhitelist,
  onEditBlacklist,
  onEditLogicalRules,
  config,
  fileName,
  userConfig,
}: DashboardProps) {
  return (
    <main className="dashboard">
      <MineralProcessSection
        userConfig={userConfig}
        processes={processes}
        onAddProcess={onAddProcess}
        onEditProcess={onEditProcess}
        onDeleteProcess={onDeleteProcess}
      />

      <ProcessReverseSection
        userConfig={userConfig}
        groups={reverseGroups}
        onReuseProcess={onReuseProcess}
      />

      <InterfaceSection
        interfaces={interfaces}
        availableRoles={roleNames}
        onAddInterface={onAddInterface}
        onEditInterface={onEditInterface}
        onDeleteInterface={onDeleteInterface}
      />

      <RoleSection
        roles={roles}
        interfaces={interfaces}
        onAddRole={onAddRole}
        onEditRole={onEditRole}
        onDeleteRole={onDeleteRole}
        onDeleteInterface={onDeleteInterface}
      />

      <FilterListCard
        userConfig={userConfig}
        title="白名单"
        kindLabel="按职责管理规则，支持启用状态和注释，显示时优先展示注释。"
        groups={idWhitelist}
        onEdit={onEditWhitelist}
      />
      <FilterListCard
        userConfig={userConfig}
        title="黑名单"
        kindLabel="按职责管理规则，支持启用状态和注释，显示时优先展示注释。"
        groups={idBlacklist}
        onEdit={onEditBlacklist}
      />
      <FilterListCard
        userConfig={userConfig}
        title="逻辑规则"
        kindLabel="按角色管理逻辑表达式，支持拖拽命令单元、运算符和括号。"
        groups={logicalRules}
        onEdit={onEditLogicalRules}
      />

      <ExportSection
        config={config}
        fileName={fileName}
      />
    </main>
  );
}
