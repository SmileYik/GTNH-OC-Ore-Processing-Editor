import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { type Config, loadConfig, saveConfig } from './config';
import {
  buildProcessReverse,
  collectAvailableSteps,
  cloneOreConfig,
  deleteInterfaceEntry,
  deleteProcessEntry,
  deleteRoleEntry,
  EMPTY_CONFIG,
  getFilterGroups,
  getInterfaceEntries,
  getProcessEntries,
  getRoleEntries,
  parseOreConfig,
  serializeOreConfig,
  setFilterGroups,
  type FilterGroup,
  type InterfaceEntry,
  type MineralProcess,
  type RoleEntry,
  upsertInterfaceEntry,
  upsertProcessEntry,
  upsertRoleEntry
} from './lib/OreConfigManager';
import { type OreConfig } from './lib/OreConfig';
import { sampleConfigName, sampleConfigText } from './sampleConfig';
import { ImportConfigModal } from './components/ImportConfigModal';
import {
  InterfaceEditorModal,
  LogicalRuleEditorModal,
  ListEditorModal,
  RoleEditorModal,
  UserConfigEditorModal,
  type EditorState
} from './components/editors';
import { ProcessBuilderModal } from './components/ProcessBuilderModal';
import { Notice, type NoticeMessage, useAutoDismissNotice } from './components/Notice';
import { Dashboard } from './components/dashboard/Dashboard';
import { loadResourceDatabase, type ResourceKind, type ResourceLocale } from './lib/resourceDatabase';

const STORAGE_KEY = 'oc-ore-processing-editor.config.v1';
const STORAGE_NAME_KEY = 'oc-ore-processing-editor.config-name.v1';

interface ResourceBootstrapRequest {
  kind: ResourceKind;
  locale: ResourceLocale;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createResourceBootstrapRequests(config: Config): ResourceBootstrapRequest[] {
  const requests: ResourceBootstrapRequest[] = [];

  if (!config.database.autoLoadFluids && !config.database.autoLoadItems) {
    return requests;
  }

  const locales = new Set<ResourceLocale>([config.lang.game as ResourceLocale, config.lang.display as ResourceLocale]);

  if (config.database.autoLoadItems) {
    for (const locale of locales) {
      requests.push({ kind: 'item', locale });
    }
  }

  if (config.database.autoLoadFluids) {
    for (const locale of locales) {
      requests.push({ kind: 'fluid', locale });
    }
  }

  return requests;
}

function createInitialConfig(): OreConfig {
  if (typeof window !== 'undefined') {
    const savedText = window.localStorage.getItem(STORAGE_KEY);
    if (savedText) {
      try {
        return parseOreConfig(savedText);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(STORAGE_NAME_KEY);
      }
    }
  }

  try {
    return parseOreConfig(sampleConfigText);
  } catch {
    return cloneOreConfig(EMPTY_CONFIG);
  }
}

function createInitialFileName(): string {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(STORAGE_NAME_KEY) || sampleConfigName;
  }

  return sampleConfigName;
}

export function App() {
  const [config, setConfig] = useState<OreConfig>(() => createInitialConfig());
  const [fileName, setFileName] = useState<string>(() => createInitialFileName());
  const [userConfig, setUserConfig] = useState<Config>(() => loadConfig());
  const [editor, setEditor] = useState<EditorState>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const [topbarHeight, setTopbarHeight] = useState(0);
  const [startupReady, setStartupReady] = useState(false);
  const [startupError, setStartupError] = useState('');
  const [importConfigOpen, setImportConfigOpen] = useState(false);
  const [userConfigOpen, setUserConfigOpen] = useState(false);
  const topbarRef = useRef<HTMLElement | null>(null);
  const showNotice = useCallback((text: string, tone: NoticeMessage['tone'] = 'info') => {
    setNotice({ tone, text });
  }, []);
  const roles = useMemo(() => getRoleEntries(config), [config]);
  const interfaces = useMemo(() => getInterfaceEntries(config), [config]);
  const processes = useMemo(() => getProcessEntries(config), [config]);
  const idWhitelist = useMemo(() => getFilterGroups(config, 'idWhitelist'), [config]);
  const idBlacklist = useMemo(() => getFilterGroups(config, 'idBlacklist'), [config]);
  const logicalRules = useMemo(() => getFilterGroups(config, 'logicalRules'), [config]);
  const availableSteps = useMemo(() => collectAvailableSteps(config), [config]);
  const reverseGroups = useMemo(() => buildProcessReverse(config), [config]);
  const interfaceIds = useMemo(() => interfaces.map((entry) => entry.id), [interfaces]);
  const roleNames = useMemo(() => roles.map((role) => role.name), [roles]);
  const stats = useMemo(
    () => ({
      roles: roles.length,
      interfaces: interfaces.length,
      processes: processes.length,
      whitelistRules: idWhitelist.reduce((sum, group) => sum + group.rules.length, 0),
      blacklistRules: idBlacklist.reduce((sum, group) => sum + group.rules.length, 0)
    }),
    [idBlacklist, idWhitelist, interfaces, processes, roles]
  );
  const startupRequests = useMemo(() => createResourceBootstrapRequests(userConfig), [userConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, serializeOreConfig(config));
      window.localStorage.setItem(STORAGE_NAME_KEY, fileName);
    } catch {
      // LocalStorage may be unavailable in some private modes.
    }
  }, [config, fileName]);

  useEffect(() => {
    saveConfig(userConfig);
  }, [userConfig]);

  useEffect(() => {
    let cancelled = false;

    if (startupRequests.length === 0) {
      setStartupReady(true);
      setStartupError('');
      return undefined;
    }

    setStartupReady(false);
    setStartupError('');

    void Promise.all(startupRequests.map(({ kind, locale }) => loadResourceDatabase(kind, locale)))
      .then(() => {
        if (!cancelled) {
          setStartupReady(true);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setStartupError(getErrorMessage(error));
        setStartupReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [startupRequests]);

  useAutoDismissNotice(notice, setNotice, 4000);

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

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (!startupReady) {
      return;
    }

    document.getElementById('app-preloader')?.remove();
  }, [startupReady]);

  useEffect(() => {
    if (!startupError) {
      return;
    }

    showNotice(`资源数据库预加载失败: ${startupError}`, 'error');
  }, [showNotice, startupError]);

  const closeEditor = () => setEditor(null);

  const handleImportText = (text: string, nextFileName: string) => {
    try {
      const parsed = parseOreConfig(text);
      setConfig(parsed);
      setFileName(nextFileName || sampleConfigName);
      closeEditor();
      setImportConfigOpen(false);
      showNotice(`已导入 ${nextFileName || sampleConfigName}`, 'success');
    } catch (error) {
      showNotice(`导入失败: ${getErrorMessage(error)}`, 'error');
    }
  };

  const handleUserConfigSave = (next: Config) => {
    setUserConfig(next);
    setUserConfigOpen(false);
    showNotice('用户配置已保存', 'success');
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

  const openWhitelistEditor = () => {
    setEditor({ type: 'list', kind: 'idWhitelist' });
  };
  const openBlacklistEditor = () => {
    setEditor({ type: 'list', kind: 'idBlacklist' });
  };
  const openLogicalRulesEditor = () => {
    setEditor({ type: 'logicalRules' });
  };

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

  const handleFilterGroupsSave = (
    kind: 'idWhitelist' | 'idBlacklist' | 'logicalRules',
    groups: FilterGroup[]
  ) => {
    
    try {
      setConfig(setFilterGroups(config, kind, groups));
      closeEditor();
      showNotice(`${{
        idWhitelist: "白名单",
        idBlacklist: "黑名单",
        logicalRules: "逻辑规则"
      }[kind]} 已保存`, 'success');
    } catch (error) {
      showNotice(getErrorMessage(error), 'error');
    }
  };

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
            <span className="chip chip--info">语言 {userConfig.lang.game} / {userConfig.lang.display}</span>
            <span className="chip chip--info">
              数据库 {userConfig.database.autoLoadItems ? '物品自动' : '物品手动'} ·{' '}
              {userConfig.database.autoLoadFluids ? '流体自动' : '流体手动'}
            </span>
          </div>

          <div className="button-row button-row--wrap">
            <button type="button" className="button button--filled" onClick={() => setUserConfigOpen(true)}>
              用户配置
            </button>
            <button type="button" className="button button--tonal" onClick={() => setImportConfigOpen(true)}>
              导入配置
            </button>
            <button type="button" className="button button--tonal" onClick={handleResetSample}>
              恢复示例
            </button>
          </div>
        </div>
      </header>

      {notice ? <Notice tone={notice.tone} floating>{notice.text}</Notice> : null}

      <Dashboard
        userConfig={userConfig}
        processes={processes}
        onAddProcess={openProcessAdd}
        onEditProcess={openProcessEdit}
        onDeleteProcess={handleProcessDelete}
        reverseGroups={reverseGroups}
        onReuseProcess={handleReuseProcess}
        roles={roles}
        interfaces={interfaces}
        roleNames={roleNames}
        onAddRole={openRoleAdd}
        onAddInterface={openInterfaceAdd}
        onEditRole={openRoleEdit}
        onDeleteRole={handleRoleDelete}
        onEditInterface={openInterfaceEdit}
        onDeleteInterface={handleInterfaceDelete}
        idWhitelist={idWhitelist}
        idBlacklist={idBlacklist}
        logicalRules={logicalRules}
        onEditWhitelist={openWhitelistEditor}
        onEditBlacklist={openBlacklistEditor}
        onEditLogicalRules={openLogicalRulesEditor}
        config={config}
        fileName={fileName}
      />

      {editor?.type === "role" ? (
        <RoleEditorModal
          open
          mode={editor.mode}
          initial={editor.initial}
          existingNames={roleNames}
          onClose={closeEditor}
          onSave={(next) => handleRoleSave(editor.originalName, next)}
        />
      ) : null}

      {editor?.type === "interface" ? (
        <InterfaceEditorModal
          open
          mode={editor.mode}
          initial={editor.initial}
          availableRoles={roleNames}
          existingIds={interfaceIds}
          onClose={closeEditor}
          onSave={(next) => handleInterfaceSave(editor.originalId, next)}
        />
      ) : null}

      {editor?.type === "process" ? (
        <ProcessBuilderModal
          open
          userConfig={userConfig}
          mode={editor.mode}
          initialMineral={editor.initialMineral}
          initialSteps={editor.initialSteps}
          availableSteps={availableSteps}
          existingProcesses={processes}
          onClose={closeEditor}
          onSave={(next, options) => handleProcessSave(editor.originalMineral, next, options)}
        />
      ) : null}

      {editor?.type === "list" ? (
        <ListEditorModal
          open
          userConfig={userConfig}
          title={editor.kind === 'idWhitelist' ? '白名单' : '黑名单'}
          groups={editor.kind === 'idWhitelist' ? idWhitelist : idBlacklist}
          availableRoles={roleNames}
          onClose={closeEditor}
          onSave={(groups) => handleFilterGroupsSave(editor.kind, groups)}
        />
      ) : null}

      {editor?.type === 'logicalRules' ? (
        <LogicalRuleEditorModal
          open
          groups={logicalRules}
          availableRoles={roleNames}
          onClose={closeEditor}
          onSave={(groups) => handleFilterGroupsSave('logicalRules', groups)}
        />
      ) : null}

      <ImportConfigModal
        open={importConfigOpen}
        initialFileName={fileName}
        onClose={() => setImportConfigOpen(false)}
        onImport={handleImportText}
      />

      <UserConfigEditorModal
        open={userConfigOpen}
        initial={userConfig}
        onClose={() => setUserConfigOpen(false)}
        onSave={handleUserConfigSave}
      />
    </div>
  );
}
