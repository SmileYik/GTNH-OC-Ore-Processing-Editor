import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  buildProcessReverse,
  collectAvailableSteps,
  deleteInterfaceEntry,
  deleteProcessEntry,
  deleteRoleEntry,
  EMPTY_CONFIG,
  parseLuaConfig,
  serializeLuaConfig,
  setFilterGroups,
  type ConfigModel,
  type FilterGroup,
  type InterfaceEntry,
  type MineralProcess,
  type ProcessReverseGroup,
  type RoleEntry,
  upsertInterfaceEntry,
  upsertProcessEntry,
  upsertRoleEntry
} from './lib/luaConfig';
import { sampleConfigName, sampleConfigText } from './sampleConfig';
import { ImportConfigModal } from './components/ImportConfigModal';
import { InterfaceEditorModal, ListEditorModal, RoleEditorModal } from './components/Editors';
import { ProcessBuilderModal } from './components/ProcessBuilderModal';
import { Dashboard } from './components/dashboard/Dashboard';
import type { ProcessSortMode, ReverseSortMode, SortDirection } from './components/dashboard/sortTypes';

const STORAGE_KEY = 'oc-ore-processing-editor.config.v1';
const STORAGE_NAME_KEY = 'oc-ore-processing-editor.config-name.v1';
const COLLATOR = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

type NoticeTone = 'info' | 'success' | 'error';

interface Notice {
  tone: NoticeTone;
  text: string;
}

type EditorState =
  | {
      type: 'role';
      mode: 'add' | 'edit';
      originalName: string | null;
      initial: RoleEntry;
    }
  | {
      type: 'interface';
      mode: 'add' | 'edit';
      originalId: string | null;
      initial: InterfaceEntry;
    }
  | {
      type: 'process';
      mode: 'add' | 'edit';
      originalMineral: string | null;
      initialMineral: string;
      initialSteps: string[];
    }
  | {
      type: 'list';
      kind: 'idWhitelist' | 'idBlacklist';
    }
  | null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createInitialConfig(): ConfigModel {
  if (typeof window !== 'undefined') {
    const savedText = window.localStorage.getItem(STORAGE_KEY);
    if (savedText) {
      try {
        return parseLuaConfig(savedText);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(STORAGE_NAME_KEY);
      }
    }
  }

  try {
    return parseLuaConfig(sampleConfigText);
  } catch {
    return EMPTY_CONFIG;
  }
}

function createInitialFileName(): string {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(STORAGE_NAME_KEY) || sampleConfigName;
  }

  return sampleConfigName;
}

function sortProcesses(
  processes: MineralProcess[],
  mode: ProcessSortMode,
  direction: SortDirection
): MineralProcess[] {
  if (direction === 'default') {
    return [...processes];
  }

  return [...processes].sort((left, right) => {
    let result = 0;

    if (mode === 'name') {
      result = COLLATOR.compare(left.mineral, right.mineral);
      if (result === 0) {
        result = left.steps.length - right.steps.length;
      }
    } else {
      result = left.steps.length - right.steps.length;
      if (result === 0) {
        result = COLLATOR.compare(left.mineral, right.mineral);
      }
    }

    return direction === 'asc' ? result : -result;
  });
}

function sortReverseGroups(
  groups: ProcessReverseGroup[],
  mode: ReverseSortMode,
  direction: SortDirection
): ProcessReverseGroup[] {
  if (direction === 'default') {
    return [...groups];
  }

  return [...groups].sort((left, right) => {
    let result = 0;

    if (mode === 'count') {
      result = left.minerals.length - right.minerals.length;
      if (result === 0) {
        result = COLLATOR.compare(left.signature, right.signature);
      }
      if (result === 0) {
        result = COLLATOR.compare(left.minerals.join(' / '), right.minerals.join(' / '));
      }
    } else {
      result = left.steps.length - right.steps.length;
      if (result === 0) {
        result = COLLATOR.compare(left.signature, right.signature);
      }
      if (result === 0) {
        result = COLLATOR.compare(left.minerals.join(' / '), right.minerals.join(' / '));
      }
    }

    return direction === 'asc' ? result : -result;
  });
}

export function App() {
  const [config, setConfig] = useState<ConfigModel>(() => createInitialConfig());
  const [fileName, setFileName] = useState<string>(() => createInitialFileName());
  const [editor, setEditor] = useState<EditorState>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [topbarHeight, setTopbarHeight] = useState(0);
  const [processSearch, setProcessSearch] = useState('');
  const [reverseSearch, setReverseSearch] = useState('');
  const [processSortMode, setProcessSortMode] = useState<ProcessSortMode>('length');
  const [processSortDirection, setProcessSortDirection] = useState<SortDirection>('default');
  const [reverseSortMode, setReverseSortMode] = useState<ReverseSortMode>('length');
  const [reverseSortDirection, setReverseSortDirection] = useState<SortDirection>('default');
  const [importConfigOpen, setImportConfigOpen] = useState(false);
  const [exportSingleLine, setExportSingleLine] = useState(false);
  const topbarRef = useRef<HTMLElement | null>(null);

  const exportText = useMemo(
    () => serializeLuaConfig(config, { compact: exportSingleLine }),
    [config, exportSingleLine]
  );
  const availableSteps = useMemo(() => collectAvailableSteps(config), [config]);
  const reverseGroups = useMemo(() => buildProcessReverse(config.processes), [config.processes]);
  const interfaceIds = useMemo(() => config.interfaces.map((entry) => entry.id), [config.interfaces]);
  const roleNames = useMemo(() => config.roles.map((role) => role.name), [config.roles]);
  const stats = useMemo(
    () => ({
      roles: config.roles.length,
      interfaces: config.interfaces.length,
      processes: config.processes.length,
      whitelistIds: config.idWhitelist.reduce((sum, group) => sum + group.ids.length, 0),
      blacklistIds: config.idBlacklist.reduce((sum, group) => sum + group.ids.length, 0)
    }),
    [config]
  );

  const filteredProcesses = useMemo(() => {
    const query = processSearch.trim().toLowerCase();
    if (!query) {
      return config.processes;
    }

    return config.processes.filter((process) =>
      `${process.mineral} ${process.steps.join(' ')}`.toLowerCase().includes(query)
    );
  }, [config.processes, processSearch]);

  const visibleProcesses = useMemo(
    () => sortProcesses(filteredProcesses, processSortMode, processSortDirection),
    [filteredProcesses, processSortDirection, processSortMode]
  );

  const filteredReverseGroups = useMemo(() => {
    const query = reverseSearch.trim().toLowerCase();
    if (!query) {
      return reverseGroups;
    }

    return reverseGroups.filter((group) =>
      `${group.signature} ${group.minerals.join(' ')}`.toLowerCase().includes(query)
    );
  }, [reverseGroups, reverseSearch]);

  const visibleReverseGroups = useMemo(
    () => sortReverseGroups(filteredReverseGroups, reverseSortMode, reverseSortDirection),
    [filteredReverseGroups, reverseSortDirection, reverseSortMode]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, exportText);
      window.localStorage.setItem(STORAGE_NAME_KEY, fileName);
    } catch {
      // LocalStorage may be unavailable in some private modes.
    }
  }, [exportText, fileName]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const measureTopbar = () => {
      const height = topbarRef.current?.getBoundingClientRect().height ?? 0;
      setTopbarHeight(height);
    };

    measureTopbar();

    const element = topbarRef.current;
    const resizeObserver = typeof ResizeObserver !== 'undefined' && element
      ? new ResizeObserver(() => {
          measureTopbar();
        })
      : null;

    if (resizeObserver && element) {
      resizeObserver.observe(element);
    }

    window.addEventListener('resize', measureTopbar);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureTopbar);
    };
  }, []);

  const showNotice = (text: string, tone: NoticeTone = 'info') => {
    setNotice({ text, tone });
  };

  const closeEditor = () => setEditor(null);

  const handleImportText = (text: string, nextFileName: string) => {
    try {
      const parsed = parseLuaConfig(text);
      setConfig(parsed);
      setFileName(nextFileName || sampleConfigName);
      setEditor(null);
      setImportConfigOpen(false);
      showNotice(`已导入 ${nextFileName || sampleConfigName}`, 'success');
    } catch (error) {
      showNotice(`导入失败: ${getErrorMessage(error)}`, 'error');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      showNotice('已复制为文本', 'success');
    } catch (error) {
      showNotice(`复制失败: ${getErrorMessage(error)}`, 'error');
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || sampleConfigName;
      link.click();
      URL.revokeObjectURL(url);
      showNotice(`已下载 ${link.download}`, 'success');
    } catch (error) {
      showNotice(`下载失败: ${getErrorMessage(error)}`, 'error');
    }
  };

  const handleResetSample = () => {
    handleImportText(sampleConfigText, sampleConfigName);
  };

  const openRoleAdd = () => {
    setEditor({
      type: 'role',
      mode: 'add',
      originalName: null,
      initial: { name: '', machine: '' }
    });
  };

  const openRoleEdit = (role: RoleEntry) => {
    setEditor({
      type: 'role',
      mode: 'edit',
      originalName: role.name,
      initial: role
    });
  };

  const openInterfaceAdd = () => {
    setEditor({
      type: 'interface',
      mode: 'add',
      originalId: null,
      initial: { id: '', role: roleNames[0] || '' }
    });
  };

  const openInterfaceEdit = (entry: InterfaceEntry) => {
    setEditor({
      type: 'interface',
      mode: 'edit',
      originalId: entry.id,
      initial: entry
    });
  };

  const openProcessAdd = () => {
    setEditor({
      type: 'process',
      mode: 'add',
      originalMineral: null,
      initialMineral: '',
      initialSteps: []
    });
  };

  const openProcessEdit = (process: MineralProcess) => {
    setEditor({
      type: 'process',
      mode: 'edit',
      originalMineral: process.mineral,
      initialMineral: process.mineral,
      initialSteps: process.steps
    });
  };

  const openWhitelistEditor = () => setEditor({ type: 'list', kind: 'idWhitelist' });
  const openBlacklistEditor = () => setEditor({ type: 'list', kind: 'idBlacklist' });

  const handleRoleSave = (originalName: string | null, next: RoleEntry) => {
    try {
      setConfig(upsertRoleEntry(config, originalName, next));
      closeEditor();
      showNotice(`职责 "${next.name}" 已保存`, 'success');
    } catch (error) {
      showNotice(getErrorMessage(error), 'error');
    }
  };

  const handleRoleDelete = (name: string) => {
    if (!window.confirm(`确认删除职责 "${name}" 吗？这会同步移除相关流程、输出口和黑白名单。`)) {
      return;
    }

    try {
      setConfig(deleteRoleEntry(config, name));
      showNotice(`职责 "${name}" 已删除`, 'success');
    } catch (error) {
      showNotice(getErrorMessage(error), 'error');
    }
  };

  const handleInterfaceSave = (originalId: string | null, next: InterfaceEntry) => {
    try {
      setConfig(upsertInterfaceEntry(config, originalId, next));
      closeEditor();
      showNotice(`输出口 "${next.id}" 已保存`, 'success');
    } catch (error) {
      showNotice(getErrorMessage(error), 'error');
    }
  };

  const handleInterfaceDelete = (id: string) => {
    if (!window.confirm(`确认删除输出口 "${id}" 吗？`)) {
      return;
    }

    try {
      setConfig(deleteInterfaceEntry(config, id));
      showNotice(`输出口 "${id}" 已删除`, 'success');
    } catch (error) {
      showNotice(getErrorMessage(error), 'error');
    }
  };

  const handleProcessSave = (
    originalMineral: string | null,
    next: MineralProcess,
    options?: { forceReplace?: boolean }
  ) => {
    try {
      setConfig(upsertProcessEntry(config, originalMineral, next, options));
      closeEditor();
      showNotice(`矿物流程 "${next.mineral}" 已保存`, 'success');
    } catch (error) {
      showNotice(getErrorMessage(error), 'error');
    }
  };

  const handleProcessDelete = (mineral: string) => {
    if (!window.confirm(`确认删除矿物流程 "${mineral}" 吗？`)) {
      return;
    }

    try {
      setConfig(deleteProcessEntry(config, mineral));
      showNotice(`矿物流程 "${mineral}" 已删除`, 'success');
    } catch (error) {
      showNotice(getErrorMessage(error), 'error');
    }
  };

  const handleReuseProcess = (steps: string[]) => {
    setEditor({
      type: 'process',
      mode: 'add',
      originalMineral: null,
      initialMineral: '',
      initialSteps: steps
    });
  };

  const handleFilterGroupsSave = (kind: 'idWhitelist' | 'idBlacklist', groups: FilterGroup[]) => {
    try {
      setConfig(setFilterGroups(config, kind, groups));
      closeEditor();
      showNotice(`${kind === 'idWhitelist' ? '白名单' : '黑名单'} 已保存`, 'success');
    } catch (error) {
      showNotice(getErrorMessage(error), 'error');
    }
  };

  const roleEditor = editor?.type === 'role' ? editor : null;
  const interfaceEditor = editor?.type === 'interface' ? editor : null;
  const processEditor = editor?.type === 'process' ? editor : null;
  const listEditor = editor?.type === 'list' ? editor : null;

  return (
    <div className="app-shell" style={{ '--topbar-height': `${topbarHeight}px` } as CSSProperties}>
      <header className="topbar" ref={topbarRef}>
        <div className="topbar__copy">
          <span className="topbar__eyebrow">Offline OC Ore Processing Editor</span>
          <h1>OC 矿处配置编辑器</h1>
          <p>离线浏览、修改并导出 OC矿处配置文件。</p>
        </div>

        <div className="topbar__actions">
          <div className="meta-pills">
            <span className="chip chip--meta">当前文件：{fileName}</span>
            <span className="chip chip--meta">职责 {stats.roles}</span>
            <span className="chip chip--meta">输出口 {stats.interfaces}</span>
            <span className="chip chip--meta">矿物 {stats.processes}</span>
          </div>

          <div className="button-row button-row--wrap">
            <button type="button" className="button button--tonal" onClick={() => setImportConfigOpen(true)}>
              导入配置
            </button>
            <button type="button" className="button button--tonal" onClick={handleResetSample}>
              恢复示例
            </button>
          </div>
        </div>
      </header>

      {notice ? (
        <div className={`notice notice--${notice.tone} notice--floating`} role="status" aria-live="polite">
          {notice.text}
        </div>
      ) : null}

      <Dashboard
        processes={visibleProcesses}
        processSearch={processSearch}
        processSortMode={processSortMode}
        processSortDirection={processSortDirection}
        onProcessSearchChange={setProcessSearch}
        onProcessSortModeChange={setProcessSortMode}
        onProcessSortDirectionChange={setProcessSortDirection}
        onAddProcess={openProcessAdd}
        onEditProcess={openProcessEdit}
        onDeleteProcess={handleProcessDelete}
        reverseGroups={visibleReverseGroups}
        reverseSearch={reverseSearch}
        reverseSortMode={reverseSortMode}
        reverseSortDirection={reverseSortDirection}
        onReverseSearchChange={setReverseSearch}
        onReverseSortModeChange={setReverseSortMode}
        onReverseSortDirectionChange={setReverseSortDirection}
        onReuseProcess={handleReuseProcess}
        roles={config.roles}
        interfaces={config.interfaces}
        roleNames={roleNames}
        onAddRole={openRoleAdd}
        onAddInterface={openInterfaceAdd}
        onEditRole={openRoleEdit}
        onDeleteRole={handleRoleDelete}
        onEditInterface={openInterfaceEdit}
        onDeleteInterface={handleInterfaceDelete}
        idWhitelist={config.idWhitelist}
        idBlacklist={config.idBlacklist}
        onEditWhitelist={openWhitelistEditor}
        onEditBlacklist={openBlacklistEditor}
        exportText={exportText}
        exportSingleLine={exportSingleLine}
        onToggleExportSingleLine={setExportSingleLine}
        onCopyExport={handleCopy}
        onDownloadExport={handleDownload}
        whitelistCount={stats.whitelistIds}
        blacklistCount={stats.blacklistIds}
      />

      {roleEditor ? (
        <RoleEditorModal
          open
          mode={roleEditor.mode}
          initial={roleEditor.initial}
          existingNames={roleNames}
          onClose={closeEditor}
          onSave={(next) => handleRoleSave(roleEditor.originalName, next)}
        />
      ) : null}

      {interfaceEditor ? (
        <InterfaceEditorModal
          open
          mode={interfaceEditor.mode}
          initial={interfaceEditor.initial}
          availableRoles={roleNames}
          existingIds={interfaceIds}
          onClose={closeEditor}
          onSave={(next) => handleInterfaceSave(interfaceEditor.originalId, next)}
        />
      ) : null}

      {processEditor ? (
        <ProcessBuilderModal
          open
          mode={processEditor.mode}
          initialMineral={processEditor.initialMineral}
          initialSteps={processEditor.initialSteps}
          availableSteps={availableSteps}
          existingProcesses={config.processes}
          onClose={closeEditor}
          onSave={(next, options) => handleProcessSave(processEditor.originalMineral, next, options)}
        />
      ) : null}

      {listEditor ? (
        <ListEditorModal
          open
          title={listEditor.kind === 'idWhitelist' ? '白名单' : '黑名单'}
          groups={listEditor.kind === 'idWhitelist' ? config.idWhitelist : config.idBlacklist}
          availableRoles={roleNames}
          onClose={closeEditor}
          onSave={(groups) => handleFilterGroupsSave(listEditor.kind, groups)}
        />
      ) : null}

      <ImportConfigModal
        open={importConfigOpen}
        initialFileName={fileName}
        onClose={() => setImportConfigOpen(false)}
        onImport={handleImportText}
      />
    </div>
  );
}
