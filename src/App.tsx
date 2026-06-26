import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './App.css';
import { type Config, useConfig } from './config';
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
  const userConfig = useConfig();
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
      blacklistRules: idBlacklist.reduce((sum, group) => sum + group.rules.length, 0),
      logicalRules: logicalRules.reduce((sum, group) => sum + group.rules.length, 0)
    }),
    [idBlacklist, idWhitelist, interfaces, logicalRules, processes, roles]
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

  const handleUserConfigSave = (_next: Config) => {
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

  const databaseStatusText = startupError ? '资源数据库异常' : startupReady ? '资源数据库就绪' : '资源数据库加载中';
  const databaseStatusClassName = startupError
    ? 'overview-status overview-status--error'
    : startupReady
      ? 'overview-status overview-status--ready'
      : 'overview-status overview-status--loading';
  const overviewStats = [
    { label: '矿物流程', value: stats.processes, hint: '正在维护的处理线' },
    { label: '职责', value: stats.roles, hint: '机器职责节点' },
    { label: 'ME 接口', value: stats.interfaces, hint: '已绑定地址' },
    { label: '白名单规则', value: stats.whitelistRules, hint: '白名单总数' },
    { label: '黑名单规则', value: stats.blacklistRules, hint: '屏蔽项总数' },
    { label: '逻辑规则', value: stats.logicalRules, hint: '表达式单元总数' }
  ];
  const workflowSteps = [
    '整理矿物处理流程',
    '绑定职责与 ME 接口',
    '补齐黑白名单与逻辑规则',
    '预览并导出 Lua 配置'
  ];

  return (
    <div className="app-shell" style={{ '--topbar-height': `${topbarHeight}px` } as CSSProperties}>
      <header className="topbar" ref={topbarRef}>
        <div className="topbar__copy">
          <h1>GTNH OC 矿处配置编辑器</h1>
          <div className="topbar__summary">
            <span className="topbar__summary-item topbar__summary-item--file" title={fileName}>
              当前文件：{fileName}
            </span>
            <span className="topbar__summary-separator" aria-hidden="true">
              ·
            </span>
            <span className="topbar__summary-item">职责 {stats.roles}</span>
            <span className="topbar__summary-item">输出口 {stats.interfaces}</span>
            <span className="topbar__summary-item">矿物 {stats.processes}</span>
          </div>
        </div>

        <div className="topbar__actions">
          <div className="button-row button-row--wrap topbar__button-row">
            <button
              type="button"
              className="button button--filled button--compact"
              onClick={() => setUserConfigOpen(true)}
              title={`语言 ${userConfig.lang.game} / ${userConfig.lang.display}，数据库 ${
                userConfig.database.autoLoadItems ? '物品自动' : '物品被动'
              }，${userConfig.database.autoLoadFluids ? '流体自动' : '流体被动'}`}
            >
              用户配置
            </button>
            <button
              type="button"
              className="button button--tonal button--compact"
              onClick={() => setImportConfigOpen(true)}
            >
              导入配置
            </button>
            <button
              type="button"
              className="button button--tonal button--compact"
              onClick={handleResetSample}
            >
              恢复示例
            </button>
          </div>
        </div>
      </header>

      {notice ? <Notice tone={notice.tone} floating>{notice.text}</Notice> : null}

      <section className="workspace-overview" aria-label="当前配置概览">
        <article className="overview-card overview-card--hero">
          <div className="overview-card__header">
            <span className="overview-card__eyebrow">当前配置</span>
            <span className="chip chip--meta">本地自动保存</span>
          </div>
          <h2 className="overview-card__title mono" title={fileName}>
            {fileName}
          </h2>
          <p className="overview-card__copy">
            这套工作台把矿物处理线、职责绑定、规则过滤和 Lua 导出收在同一个视图里，适合连续整理整份矿处配置。
          </p>
          <div className="overview-card__meta">
            <span className="chip chip--path">游戏语言 {userConfig.lang.game}</span>
            <span className="chip chip--soft">显示语言 {userConfig.lang.display}</span>
            <span className="chip chip--soft">
              物品数据库 {userConfig.database.autoLoadItems ? '自动加载' : '被动加载'}
            </span>
            <span className="chip chip--soft">
              流体数据库 {userConfig.database.autoLoadFluids ? '自动加载' : '被动加载'}
            </span>
            <span className={databaseStatusClassName}>{databaseStatusText}</span>
          </div>
        </article>

        <article className="overview-card overview-card--deck">
          <div className="overview-card__header">
            <div className="overview-card__heading">
              <span className="overview-card__eyebrow">工作台指标</span>
              <span className="overview-card__caption">围绕配置编辑链路重新排布视图</span>
            </div>
          </div>

          <div className="overview-stat-grid">
            {overviewStats.map((item) => (
              <div className="overview-stat" key={item.label}>
                <span className="overview-stat__value">{item.value}</span>
                <span className="overview-stat__label">{item.label}</span>
                <span className="overview-stat__hint">{item.hint}</span>
              </div>
            ))}
          </div>

          <div className="overview-flow" aria-label="编辑流程">
            {workflowSteps.map((step, index) => (
              <div className="overview-flow__item" key={step}>
                <span className="overview-flow__index">{index + 1}</span>
                <span className="overview-flow__label">{step}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <Dashboard
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
        onClose={() => setUserConfigOpen(false)}
        onSave={handleUserConfigSave}
      />
    </div>
  );
}
