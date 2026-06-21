import type { OreConfig } from '../../lib/OreConfig';
import type { FilterGroup, InterfaceEntry, MineralProcess, ProcessReverseGroup, RoleEntry } from '../../lib/OreConfigManager';
import { ExportSection } from './ExportSection';
import { FilterListCard } from './FilterListCard';
import { InterfaceSection } from './InterfaceSection';
import { MineralProcessSection } from './MineralProcessSection';
import { ProcessReverseSection } from './ProcessReverseSection';
import { RoleSection } from './RoleSection';
import type { ProcessSortMode, ReverseSortMode, SortDirection } from './sortTypes';

interface DashboardProps {
  processes: MineralProcess[];
  processSearch: string;
  processSortMode: ProcessSortMode;
  processSortDirection: SortDirection;
  onProcessSearchChange: (value: string) => void;
  onProcessSortModeChange: (value: ProcessSortMode) => void;
  onProcessSortDirectionChange: (value: SortDirection) => void;
  onAddProcess: () => void;
  onEditProcess: (process: MineralProcess) => void;
  onDeleteProcess: (mineral: string) => void;
  reverseGroups: ProcessReverseGroup[];
  reverseSearch: string;
  reverseSortMode: ReverseSortMode;
  reverseSortDirection: SortDirection;
  onReverseSearchChange: (value: string) => void;
  onReverseSortModeChange: (value: ReverseSortMode) => void;
  onReverseSortDirectionChange: (value: SortDirection) => void;
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
  onEditWhitelist: () => void;
  onEditBlacklist: () => void;
  config: OreConfig;
  fileName: string;
}

export function Dashboard({
  processes,
  processSearch,
  processSortMode,
  processSortDirection,
  onProcessSearchChange,
  onProcessSortModeChange,
  onProcessSortDirectionChange,
  onAddProcess,
  onEditProcess,
  onDeleteProcess,
  reverseGroups,
  reverseSearch,
  reverseSortMode,
  reverseSortDirection,
  onReverseSearchChange,
  onReverseSortModeChange,
  onReverseSortDirectionChange,
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
  onEditWhitelist,
  onEditBlacklist,
  config,
  fileName
}: DashboardProps) {
  return (
    <main className="dashboard">
      <MineralProcessSection
        processes={processes}
        search={processSearch}
        sortMode={processSortMode}
        sortDirection={processSortDirection}
        onSearchChange={onProcessSearchChange}
        onSortModeChange={onProcessSortModeChange}
        onSortDirectionChange={onProcessSortDirectionChange}
        onAddProcess={onAddProcess}
        onEditProcess={onEditProcess}
        onDeleteProcess={onDeleteProcess}
      />

      <ProcessReverseSection
        groups={reverseGroups}
        search={reverseSearch}
        sortMode={reverseSortMode}
        sortDirection={reverseSortDirection}
        onSearchChange={onReverseSearchChange}
        onSortModeChange={onReverseSortModeChange}
        onSortDirectionChange={onReverseSortDirectionChange}
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

      <FilterListCard title="白名单" kindLabel="给指定职责的机器设置物品白名单, 格式为: 物品内部名称#物品损伤值" groups={idWhitelist} onEdit={onEditWhitelist} />
      <FilterListCard title="黑名单" kindLabel="给指定职责的机器设置物品黑名单, 格式为: 物品内部名称#物品损伤值" groups={idBlacklist} onEdit={onEditBlacklist} />

      <ExportSection
        config={config}
        fileName={fileName}
      />
    </main>
  );
}
