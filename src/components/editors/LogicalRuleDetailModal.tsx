import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { FilterRuleEntry } from '../../lib/OreConfigManager';
import { Modal } from '../Modal';
import { fieldRow } from './shared';
import { LogicalCommandTokenInfoModal } from './LogicalCommandTokenInfoModal';
import { LogicalCommandTokenEditorModal } from './LogicalCommandTokenEditorModal';
import {
  createLogicalCommandToken,
  createLogicalOperatorToken,
  createLogicalParenToken,
  deleteLogicalCommandCacheEntry,
  findLogicalCommandCacheEntry,
  findLogicalCommandCacheEntryBySnapshot,
  formatLogicalCommandCacheItem,
  formatLogicalCommandSnapshot,
  formatLogicalCommandTooltip,
  getLogicalCommandDefinitionsByCategory,
  lexLogicalExpression,
  loadLogicalCommandCacheState,
  materializeLogicalExpressionTokens,
  saveLogicalCommandCacheState,
  serializeLogicalExpression,
  setLogicalCommandCacheLimit,
  toggleLogicalCommandCachePin,
  type LogicalCommandCacheState,
  type LogicalCommandSnapshot,
  type LogicalExpressionToken,
  type LogicalOperator,
  type LogicalParen,
  upsertLogicalCommandCacheSnapshot,
  validateLogicalExpression
} from '../../lib/logical/LogicalRules';
import { type Config, useConfig } from '../../config';

type DragSource =
  | {
      kind: 'token';
      tokenId: string;
    }
  | {
      kind: 'template';
      commandName: string;
    }
  | {
      kind: 'cache';
      cacheId: string;
    }
  | {
      kind: 'operator';
      value: LogicalOperator;
    }
  | {
      kind: 'paren';
      value: LogicalParen;
    }
  | null;

type CommandGroup = ReturnType<typeof getLogicalCommandDefinitionsByCategory>[number];
type CommandDefinition = CommandGroup['items'][number];
type LogicalRuleDetailTab = 'visual' | 'metadata' | 'manual';

const LOGICAL_RULE_DETAIL_TABS: Array<{
  id: LogicalRuleDetailTab;
  label: string;
  description: string;
}> = [
  {
    id: 'metadata',
    label: '规则元数据编辑',
    description: '启用状态和规则注释'
  },
  {
    id: 'visual',
    label: '可视化编辑规则',
    description: '命令库、缓存库和工作台'
  },
  {
    id: 'manual',
    label: '手动设置规则',
    description: '直接编辑规则文本'
  }
];

interface LogicalRuleDetailModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  groupRole: string;
  initialRule: FilterRuleEntry;
  onClose: () => void;
  onSave: (next: FilterRuleEntry) => void;
}

function createEmptyRuleDraft(): FilterRuleEntry {
  return {
    rule: '',
    enable: true,
    comments: ''
  };
}

function readExpressionTokens(ruleText: string): { tokens: LogicalExpressionToken[]; error: string } {
  try {
    return {
      tokens: materializeLogicalExpressionTokens(lexLogicalExpression(ruleText)),
      error: ''
    };
  } catch (error) {
    return {
      tokens: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function createCommandTokenSnapshot(token: LogicalExpressionToken): LogicalCommandSnapshot | null {
  if (token.type !== 'command') {
    return null;
  }

  return {
    name: token.name,
    args: token.args
  };
}

function cloneExpressionToken(token: LogicalExpressionToken): LogicalExpressionToken {
  if (token.type === 'command') {
    return {
      ...token,
      id: `cmd_${Math.random().toString(36).slice(2, 10)}`
    };
  }

  if (token.type === 'operator') {
    return {
      ...token,
      id: `op_${Math.random().toString(36).slice(2, 10)}`
    };
  }

  return {
    ...token,
    id: `par_${Math.random().toString(36).slice(2, 10)}`
  };
}

function matchesCommandQuery(definition: CommandDefinition, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    definition.name,
    definition.label,
    definition.category,
    definition.description,
    definition.argsLabel,
    definition.argsPlaceholder,
    definition.argsHint,
    ...definition.aliases
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

interface LogicalFlowSlotProps {
  index: number;
  active: boolean;
  onDropAt: (index: number) => void;
  onDragEnterAt: (index: number) => void;
  onActivate: (index: number) => void;
}

function LogicalFlowSlot({ index, active, onDropAt, onDragEnterAt, onActivate }: LogicalFlowSlotProps) {
  return (
    <button
      type="button"
      className={`logical-flow-slot${active ? ' is-active' : ''}`}
      onClick={() => onActivate(index)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragEnterAt(index);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragEnterAt(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropAt(index);
      }}
      aria-label={`插入位置 ${index + 1}`}
      title="点击设定插入位置，或把命令拖到这里"
    >
      +
    </button>
  );
}

interface LogicalTokenChipProps {
  token: LogicalExpressionToken;
  active: boolean;
  userConfig: Config,
  onSelect: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onEdit?: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

function LogicalTokenChip({
  token,
  active,
  userConfig,
  onSelect,
  onDelete,
  onDragStart,
  onDragEnd,
  onEdit,
  onContextMenu
}: LogicalTokenChipProps) {
  const title =
    token.type === 'command'
      ? formatLogicalCommandTooltip(token)
      : token.type === 'operator'
        ? `运算符: ${token.value}`
        : `括号: ${token.value}`;

  const label =
    token.type === 'command'
      ? formatLogicalCommandSnapshot(token, userConfig.lang)
      : token.type === 'operator'
        ? token.value
        : token.value;

  const meta =
    token.type === 'command'
      ? '命令'
      : token.type === 'operator'
        ? '运算符'
        : '括号';

  return (
    <div
      className={`logical-token${token.type === 'operator' ? ' logical-token--operator' : ''}${token.type === 'paren' ? ' logical-token--paren' : ''}${active ? ' is-active' : ''}`}
      role="button"
      tabIndex={0}
      draggable
      onClick={onSelect}
      onDoubleClick={(event) => {
        if (token.type !== 'command' || !onEdit) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onEdit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={(event) => {
        if (token.type !== 'command' || !onContextMenu) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onContextMenu(event);
      }}
      title={title}
    >
      <span className="logical-token__meta">{meta}</span>
      <span className="logical-token__label">{label}</span>
      <button
        type="button"
        className="logical-token__delete"
        aria-label="删除 token"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}

interface LogicalCommandCardProps {
  definition: CommandDefinition;
  onInsert: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}

function LogicalCommandCard({ definition, onInsert, onDragStart, onDragEnd }: LogicalCommandCardProps) {
  return (
    <button
      type="button"
      className="palette-card logical-command-card"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onInsert}
      title={definition.description}
    >
      <span className="logical-command-card__title">{definition.label}</span>
      <span className="logical-command-card__name">{definition.name}</span>
      <span className="logical-command-card__aliases">
        {definition.aliases.length > 0 ? definition.aliases.join(' / ') : '无别名'}
      </span>
    </button>
  );
}

export function LogicalRuleDetailModal({
  open,
  mode,
  groupRole,
  initialRule,
  onClose,
  onSave
}: LogicalRuleDetailModalProps) {
  const userConfig = useConfig();
  const [ruleDraft, setRuleDraft] = useState<FilterRuleEntry>(createEmptyRuleDraft());
  const [expressionTokens, setExpressionTokens] = useState<LogicalExpressionToken[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [cacheState, setCacheState] = useState<LogicalCommandCacheState>(() => loadLogicalCommandCacheState());
  const [commandQuery, setCommandQuery] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<LogicalRuleDetailTab>('metadata');
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(0);
  const [commandEditorTokenId, setCommandEditorTokenId] = useState<string | null>(null);
  const [commandInfoTokenId, setCommandInfoTokenId] = useState<string | null>(null);
  const [tokenContextMenu, setTokenContextMenu] = useState<{ tokenId: string; x: number; y: number } | null>(null);
  const dragSourceRef = useRef<DragSource>(null);

  const commandGroups = useMemo(() => getLogicalCommandDefinitionsByCategory(), []);
  const normalizedQuery = commandQuery.trim().toLowerCase();
  const visibleCommandGroups = useMemo(
    () =>
      commandGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((definition) => matchesCommandQuery(definition, normalizedQuery))
        }))
        .filter((group) => group.items.length > 0),
    [commandGroups, normalizedQuery]
  );
  const visibleCacheState = useMemo(
    () => {
      return {
        maxItems: cacheState.maxItems,
        items: cacheState.items.filter(it => normalizedQuery ? [it.name, it.args, formatLogicalCommandCacheItem(it, userConfig.lang)].join(' ').toLowerCase().includes(normalizedQuery) : true)
      } as LogicalCommandCacheState
    },
    [cacheState, normalizedQuery]
  )

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextRule = {
      rule: initialRule.rule ?? '',
      enable: initialRule.enable,
      comments: initialRule.comments
    };

    const loaded = readExpressionTokens(nextRule.rule);
    setRuleDraft(nextRule);
    setExpressionTokens(loaded.tokens);
    setSelectedTokenId(loaded.tokens[0]?.id ?? null);
    setActiveSlotIndex(loaded.tokens.length > 0 ? null : 0);
    setCommandQuery('');
    setError(loaded.error);
    dragSourceRef.current = null;
    setCacheState(loadLogicalCommandCacheState());
    setActiveTab('metadata');
  }, [open, initialRule]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    saveLogicalCommandCacheState(cacheState);
  }, [cacheState]);

  useEffect(() => {
    if (!tokenContextMenu) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setTokenContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [tokenContextMenu]);

  const selectedToken = expressionTokens.find((token) => token.id === selectedTokenId) ?? null;
  const commandEditorToken = commandEditorTokenId
    ? expressionTokens.find((token) => token.id === commandEditorTokenId) ?? null
    : null;
  const editingCommandToken =
    commandEditorToken && commandEditorToken.type === 'command' ? commandEditorToken : null;
  const commandInfoToken = commandInfoTokenId
    ? expressionTokens.find((token) => token.id === commandInfoTokenId) ?? null
    : null;
  const commandInfoCommandToken =
    commandInfoToken && commandInfoToken.type === 'command' ? commandInfoToken : null;

  useEffect(() => {
    if (commandEditorTokenId && !editingCommandToken) {
      setCommandEditorTokenId(null);
    }
  }, [commandEditorTokenId, editingCommandToken]);

  useEffect(() => {
    if (commandInfoTokenId && !commandInfoToken) {
      setCommandInfoTokenId(null);
    }
  }, [commandInfoTokenId, commandInfoToken]);

  const expressionPreview = serializeLogicalExpression(expressionTokens);
  const pinnedCacheCount = cacheState.items.filter((item) => item.pinned).length;
  const autoCacheCount = cacheState.items.length - pinnedCacheCount;
  const cacheSummary = `固定 ${pinnedCacheCount} · 自动 ${autoCacheCount}/${cacheState.maxItems}`;

  const commitTokens = (nextTokens: LogicalExpressionToken[], nextSelectedTokenId: string | null) => {
    const nextRuleText = serializeLogicalExpression(nextTokens);
    const selectedIndex =
      nextSelectedTokenId !== null ? nextTokens.findIndex((token) => token.id === nextSelectedTokenId) : -1;

    setExpressionTokens(nextTokens);
    setSelectedTokenId(nextSelectedTokenId);
    setActiveSlotIndex(selectedIndex >= 0 ? selectedIndex + 1 : nextTokens.length > 0 ? null : 0);
    setRuleDraft((current) => ({
      ...current,
      rule: nextRuleText
    }));
    setError('');
  };

  const handleManualRuleChange = (nextRuleText: string) => {
    setRuleDraft((current) => ({
      ...current,
      rule: nextRuleText
    }));
    dragSourceRef.current = null;
    setTokenContextMenu(null);
    setCommandEditorTokenId(null);
    setCommandInfoTokenId(null);

    const loaded = readExpressionTokens(nextRuleText);
    if (loaded.error) {
      setSelectedTokenId(null);
      setActiveSlotIndex(null);
      setError(loaded.error);
      return;
    }

    setExpressionTokens(loaded.tokens);
    setSelectedTokenId(loaded.tokens[0]?.id ?? null);
    setActiveSlotIndex(loaded.tokens.length > 0 ? null : 0);
    setError('');
  };

  const ensureCacheSnapshot = (snapshot: LogicalCommandSnapshot, cacheId?: string): string | undefined => {
    const existingBySnapshot = findLogicalCommandCacheEntryBySnapshot(cacheState, snapshot);
    const existingById = cacheId ? findLogicalCommandCacheEntry(cacheState, cacheId) : null;
    const existing = existingBySnapshot ?? existingById;

    if (!existing && cacheState.maxItems <= 0) {
      return undefined;
    }

    const { state: nextState, id } = upsertLogicalCommandCacheSnapshot(cacheState, snapshot, {
      id: existingById?.id ?? cacheId,
      pinned: existing?.pinned
    });

    setCacheState(nextState);
    return id;
  };

  const insertCommandToken = (commandName: string, args = '', insertionIndexOverride?: number) => {
    const insertionIndex = Math.max(
      0,
      Math.min(insertionIndexOverride ?? activeSlotIndex ?? expressionTokens.length, expressionTokens.length)
    );
    const cacheId = ensureCacheSnapshot({ name: commandName, args });
    const token = createLogicalCommandToken(commandName, args, cacheId);
    const nextTokens = [...expressionTokens];
    nextTokens.splice(insertionIndex, 0, token);
    commitTokens(nextTokens, token.id);
  };

  const insertCacheSnapshot = (snapshot: LogicalCommandSnapshot, insertionIndexOverride?: number) => {
    const insertionIndex = Math.max(
      0,
      Math.min(insertionIndexOverride ?? activeSlotIndex ?? expressionTokens.length, expressionTokens.length)
    );
    const cacheId = ensureCacheSnapshot(snapshot);
    const token = createLogicalCommandToken(snapshot.name, snapshot.args, cacheId);
    const nextTokens = [...expressionTokens];
    nextTokens.splice(insertionIndex, 0, token);
    commitTokens(nextTokens, token.id);
  };

  const insertOperatorToken = (value: LogicalOperator, insertionIndexOverride?: number) => {
    const insertionIndex = Math.max(
      0,
      Math.min(insertionIndexOverride ?? activeSlotIndex ?? expressionTokens.length, expressionTokens.length)
    );
    const token = createLogicalOperatorToken(value);
    const nextTokens = [...expressionTokens];
    nextTokens.splice(insertionIndex, 0, token);
    commitTokens(nextTokens, token.id);
  };

  const insertParenToken = (value: LogicalParen, insertionIndexOverride?: number) => {
    const insertionIndex = Math.max(
      0,
      Math.min(insertionIndexOverride ?? activeSlotIndex ?? expressionTokens.length, expressionTokens.length)
    );
    const token = createLogicalParenToken(value);
    const nextTokens = [...expressionTokens];
    nextTokens.splice(insertionIndex, 0, token);
    commitTokens(nextTokens, token.id);
  };

  const moveTokenTo = (tokenId: string, index: number) => {
    const sourceIndex = expressionTokens.findIndex((token) => token.id === tokenId);
    if (sourceIndex < 0) {
      return;
    }

    const nextTokens = [...expressionTokens];
    const [moved] = nextTokens.splice(sourceIndex, 1);
    let targetIndex = index;

    if (sourceIndex < index) {
      targetIndex -= 1;
    }

    targetIndex = Math.max(0, Math.min(targetIndex, nextTokens.length));
    nextTokens.splice(targetIndex, 0, moved);
    commitTokens(nextTokens, moved.id);
  };

  const handleDropAt = (index: number) => {
    const source = dragSourceRef.current;
    if (!source) {
      return;
    }

    if (source.kind === 'token') {
      moveTokenTo(source.tokenId, index);
    } else if (source.kind === 'template') {
      insertCommandToken(source.commandName, '', index);
    } else if (source.kind === 'cache') {
      const cacheItem = findLogicalCommandCacheEntry(cacheState, source.cacheId);
      if (cacheItem) {
        insertCacheSnapshot(
          {
            name: cacheItem.name,
            args: cacheItem.args
          },
          index
        );
      }
    } else if (source.kind === 'operator') {
      insertOperatorToken(source.value, index);
    } else if (source.kind === 'paren') {
      insertParenToken(source.value, index);
    }

    dragSourceRef.current = null;
    setActiveSlotIndex(null);
  };

  const openCommandEditorForToken = (tokenId: string) => {
    const token = expressionTokens.find((entry) => entry.id === tokenId);
    if (!token || token.type !== 'command') {
      return;
    }

    setSelectedTokenId(tokenId);
    setCommandInfoTokenId(null);
    setCommandEditorTokenId(tokenId);
    setTokenContextMenu(null);
  };

  const openCommandInfoForToken = (tokenId: string) => {
    const token = expressionTokens.find((entry) => entry.id === tokenId);
    if (!token || token.type !== 'command') {
      return;
    }

    setSelectedTokenId(tokenId);
    setCommandEditorTokenId(null);
    setCommandInfoTokenId(tokenId);
    setTokenContextMenu(null);
  };

  const openTokenContextMenu = (tokenId: string, clientX: number, clientY: number) => {
    const token = expressionTokens.find((entry) => entry.id === tokenId);
    if (!token || token.type !== 'command') {
      return;
    }

    const menuWidth = 184;
    const menuHeight = 74;
    const nextX = Math.max(12, Math.min(clientX, window.innerWidth - menuWidth - 12));
    const nextY = Math.max(12, Math.min(clientY, window.innerHeight - menuHeight - 12));

    setSelectedTokenId(tokenId);
    setTokenContextMenu({
      tokenId,
      x: nextX,
      y: nextY
    });
  };

  const closeTokenContextMenu = () => {
    setTokenContextMenu(null);
  };

  const updateCommandTokenById = (tokenId: string, nextName: string, nextArgs: string) => {
    const targetToken = expressionTokens.find((token) => token.id === tokenId);
    if (!targetToken || targetToken.type !== 'command') {
      return;
    }

    const nextNameValue = nextName.trim();
    const cacheId = ensureCacheSnapshot({ name: nextNameValue, args: nextArgs }, targetToken.cacheId);
    const nextTokens = expressionTokens.map((token) =>
      token.id === tokenId
        ? {
            ...token,
            name: nextNameValue,
            args: nextArgs,
            cacheId
          }
        : token
    );

    commitTokens(nextTokens, tokenId);
  };

  const duplicateSelectedToken = () => {
    if (!selectedToken) {
      return;
    }

    const duplicate = cloneExpressionToken(selectedToken);
    if (duplicate.type === 'command') {
      const snapshot = createCommandTokenSnapshot(duplicate);
      const cacheId = snapshot ? ensureCacheSnapshot(snapshot) : undefined;
      if (cacheId) {
        duplicate.cacheId = cacheId;
      } else {
        delete duplicate.cacheId;
      }
    }

    const insertionIndex = selectedTokenId
      ? expressionTokens.findIndex((token) => token.id === selectedTokenId) + 1
      : expressionTokens.length;
    const nextTokens = [...expressionTokens];
    nextTokens.splice(insertionIndex, 0, duplicate);
    commitTokens(nextTokens, duplicate.id);
  };

  const removeSelectedToken = () => {
    if (!selectedToken) {
      return;
    }

    const sourceIndex = expressionTokens.findIndex((token) => token.id === selectedToken.id);
    if (sourceIndex < 0) {
      return;
    }

    const nextTokens = expressionTokens.filter((token) => token.id !== selectedToken.id);
    const nextSelectedToken = nextTokens[sourceIndex] ?? nextTokens[sourceIndex - 1] ?? null;
    commitTokens(nextTokens, nextSelectedToken?.id ?? null);
  };

  const updateSelectedOperatorToken = (value: LogicalOperator) => {
    if (!selectedToken || selectedToken.type !== 'operator') {
      return;
    }

    const nextTokens = expressionTokens.map(
      (token): LogicalExpressionToken =>
        token.id === selectedToken.id ? ({ ...token, value } as LogicalExpressionToken) : token
    );

    commitTokens(nextTokens, selectedToken.id);
  };

  const updateSelectedParenToken = (value: LogicalParen) => {
    if (!selectedToken || selectedToken.type !== 'paren') {
      return;
    }

    const nextTokens = expressionTokens.map(
      (token): LogicalExpressionToken =>
        token.id === selectedToken.id ? ({ ...token, value } as LogicalExpressionToken) : token
    );

    commitTokens(nextTokens, selectedToken.id);
  };

  const handleSave = () => {
    const nextRule = ruleDraft.rule.trim();
    if (!nextRule) {
      setError('规则不能为空');
      return;
    }

    try {
      validateLogicalExpression(nextRule);
    } catch (validationError) {
      setError(
        validationError instanceof Error ? validationError.message : String(validationError)
      );
      return;
    }

    onSave({
      rule: nextRule,
      enable: ruleDraft.enable,
      comments: ruleDraft.comments.trim()
    });
  };

  const footer = (
    <>
      <button type="button" className="button button--tonal" onClick={onClose}>
        取消
      </button>
      <button type="button" className="button button--filled" onClick={handleSave}>
        {mode === 'create' ? '添加规则' : '保存规则'}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新建规则' : '编辑规则'}
      subtitle={`角色组：${groupRole || '未命名角色组'} · 使用标签页切换可视化、元数据和文本编辑。`}
      wide
      sheetClassName="modal-sheet--logical-rule"
      closeOnEscape={!(editingCommandToken || commandInfoToken || tokenContextMenu)}
      onClose={onClose}
      footer={footer}
    >
      <div className="logical-rule-tabs">
        <div className="logical-rule-tabs__list" role="tablist" aria-label="规则编辑方式">
          {LOGICAL_RULE_DETAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`logical-rule-panel-${tab.id}`}
              id={`logical-rule-tab-${tab.id}`}
              className={`logical-rule-tabs__tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="logical-rule-tabs__tab-label">{tab.label}</span>
              <span className="logical-rule-tabs__tab-desc">{tab.description}</span>
            </button>
          ))}
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="logical-rule-tabs__panels">
          <section
            role="tabpanel"
            id="logical-rule-panel-visual"
            aria-labelledby="logical-rule-tab-visual"
            hidden={activeTab !== 'visual'}
            className="logical-rule-tab-panel logical-rule-tab-panel--visual"
          >
            <div className="logical-rule-workbench">
        <section className="editor-card logical-rule-workbench__library">
          <div className="logical-rule-workbench__section-header">
            <div>
              <h3 className="editor-card__title">命令库</h3>
              <p className="logical-rule-workbench__section-copy">点击或拖拽命令、运算符和括号到表达式里。</p>
            </div>
            <span className="chip chip--soft">{visibleCommandGroups.length} 类</span>
          </div>

          <div className="logical-operator-palette">
            {(['!', '&&', '||', '(', ')'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="palette-card logical-operator-card"
                draggable
                onDragStart={(event) => {
                  if (value === '!' || value === '&&' || value === '||') {
                    dragSourceRef.current = { kind: 'operator', value };
                  } else {
                    dragSourceRef.current = { kind: 'paren', value };
                  }
                  event.dataTransfer.effectAllowed = 'copyMove';
                  event.dataTransfer.setData('text/plain', value);
                }}
                onDragEnd={() => {
                  dragSourceRef.current = null;
                  setActiveSlotIndex(null);
                }}
                onClick={() => {
                  if (value === '!' || value === '&&' || value === '||') {
                    insertOperatorToken(value);
                  } else {
                    insertParenToken(value);
                  }
                }}
              >
                <span className="logical-operator-card__symbol">{value}</span>
                <span className="logical-operator-card__tip">
                  {value === '!' ? '非' : value === '&&' ? '与' : value === '||' ? '或' : value === '(' ? '左括号' : '右括号'}
                </span>
              </button>
            ))}
          </div>

         {fieldRow(
            '搜索命令',
            <input
              className="input input--compact"
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              placeholder="按命令名、别名或说明筛选"
            />,
            '搜索结果会同步影响顶部命令库与底部缓存分组的可见内容。'
          )}

          <div className="logical-command-palette">
            {visibleCommandGroups.length === 0 ? (
              <div className="empty-state empty-state--compact">
                <span>没有找到匹配的命令。</span>
              </div>
            ) : (
              visibleCommandGroups.map((group) => (
                <section key={group.category} className="logical-command-group">
                  <div className="logical-command-group__header">
                    <h3>{group.category}命令</h3>
                    <span>点击或拖拽</span>
                  </div>
                  <div className="logical-command-group__items">
                    {group.items.map((definition) => (
                      <LogicalCommandCard
                        key={definition.name}
                        definition={definition}
                        onInsert={() => insertCommandToken(definition.name)}
                        onDragStart={(event) => {
                          dragSourceRef.current = {
                            kind: 'template',
                            commandName: definition.name
                          };
                          event.dataTransfer.effectAllowed = 'copyMove';
                          event.dataTransfer.setData('text/plain', definition.name);
                        }}
                        onDragEnd={() => {
                          dragSourceRef.current = null;
                          setActiveSlotIndex(null);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          <section className="logical-rule-workbench__cache">
            <div className="logical-rule-workbench__section-header">
              <div>
                <h3 className="editor-card__title">缓存库</h3>
                <p className="logical-rule-workbench__section-copy">{cacheSummary}</p>
              </div>
            </div>

            <div className="logical-cache-list">
              {visibleCacheState.items.length === 0 ? (
                <div className="empty-state empty-state--compact">暂无缓存的命令实例。</div>
              ) : (
                visibleCacheState.items.map((item) => {
                  const isLinked = selectedToken?.type === 'command' && selectedToken.cacheId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`logical-cache-item${item.pinned ? ' is-pinned' : ''}${isLinked ? ' is-linked' : ''}`}
                      role="button"
                      tabIndex={0}
                      draggable
                      onClick={() =>
                        insertCacheSnapshot({
                          name: item.name,
                          args: item.args
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          insertCacheSnapshot({
                            name: item.name,
                            args: item.args
                          });
                        }
                      }}
                      onDragStart={(event) => {
                        dragSourceRef.current = { kind: 'cache', cacheId: item.id };
                        event.dataTransfer.effectAllowed = 'copyMove';
                        event.dataTransfer.setData('text/plain', item.id);
                      }}
                      onDragEnd={() => {
                        dragSourceRef.current = null;
                        setActiveSlotIndex(null);
                      }}
                    >
                      <span className="logical-cache-item__title">{formatLogicalCommandCacheItem(item, userConfig.lang)}</span>
                      <span className="logical-cache-item__meta">
                        {item.pinned ? '已固定' : '自动缓存'}
                        {isLinked ? ' · 当前使用中' : ''}
                      </span>
                      <div className="logical-cache-item__actions">
                        <button
                          type="button"
                          className="button button--tonal button--compact"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCacheState((current) => toggleLogicalCommandCachePin(current, item.id));
                          }}
                        >
                          {item.pinned ? '取消固定' : '固定'}
                        </button>
                        <button
                          type="button"
                          className="button button--danger button--compact"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCacheState((current) => deleteLogicalCommandCacheEntry(current, item.id));
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="logical-rule-workbench__cache-settings">
              {fieldRow(
                '自动缓存上限',
                <input
                  className="input input--compact"
                  type="number"
                  min={0}
                  value={cacheState.maxItems}
                  onChange={(event) => {
                    const nextLimit = Number(event.target.value);
                    setCacheState((current) =>
                      setLogicalCommandCacheLimit(current, Number.isFinite(nextLimit) ? nextLimit : 0)
                    );
                  }}
                />,
                '未固定的缓存项会按最近使用顺序保留。'
              )}
            </div>
          </section>
        </section>

        <div className="logical-rule-workbench__right">
          <section className="editor-card logical-rule-workbench__workspace">
          <div className="logical-rule-workbench__section-header">
            <div>
              <h3 className="editor-card__title">规则工作台</h3>
            </div>
            <div className="chip chip--path">
              {groupRole || '未命名角色组'}
              {mode === 'create' ? ' / 新建规则' : ' / 编辑规则'}
            </div>
          </div>

          <div className="logical-rule-workbench__meta">
            {fieldRow(
              '表达式预览',
              <code className="logical-rule-editor__preview mono">{expressionPreview || '(空表达式)'}</code>,
              '下方工作区会实时生成这里的字符串。'
            )}
          </div>

          <div className="logical-flow-rail">
            <LogicalFlowSlot
              index={0}
              active={activeSlotIndex === 0}
              onDropAt={handleDropAt}
              onDragEnterAt={(index) => setActiveSlotIndex(index)}
              onActivate={(index) => setActiveSlotIndex(index)}
            />

            {expressionTokens.map((token, index) => (
              <Fragment key={token.id}>
                <LogicalTokenChip
                  userConfig={userConfig}
                  token={token}
                  active={selectedTokenId === token.id}
                  onSelect={() => {
                    setSelectedTokenId(token.id);
                    setActiveSlotIndex(index + 1);
                  }}
                  onDragStart={(event) => {
                    dragSourceRef.current = { kind: 'token', tokenId: token.id };
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', token.id);
                  }}
                  onDragEnd={() => {
                    dragSourceRef.current = null;
                    setActiveSlotIndex(null);
                  }}
                  onEdit={() => openCommandEditorForToken(token.id)}
                  onContextMenu={(event) => openTokenContextMenu(token.id, event.clientX, event.clientY)}
                  onDelete={() => {
                    setSelectedTokenId(token.id);
                    removeSelectedToken();
                  }}
                />

                <LogicalFlowSlot
                  index={index + 1}
                  active={activeSlotIndex === index + 1}
                  onDropAt={handleDropAt}
                  onDragEnterAt={(slotIndex) => setActiveSlotIndex(slotIndex)}
                  onActivate={(slotIndex) => setActiveSlotIndex(slotIndex)}
                />
              </Fragment>
            ))}
          </div>

          {expressionTokens.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <strong>表达式还是空的</strong>
              <span>从命令库点击、拖拽，或者从底部缓存分组拖入一个命令实例。</span>
            </div>
          ) : null}

          <div className="logical-token-editor">
            {!selectedToken ? (
              <div className="empty-state empty-state--compact">
                <span>点击一个 token 开始编辑参数、运算符或括号。</span>
              </div>
            ) : selectedToken.type === 'command' ? (
              <div className="empty-state empty-state--compact">
                <strong>节点编辑</strong>
                <span>右击节点点“信息”查看详情，双击节点或使用“编辑”继续修改命令名和参数。</span>
              </div>) : selectedToken.type === 'operator' ? (
              <div className="editor-card">
                <h3 className="editor-card__title">运算符</h3>
                {fieldRow(
                  '运算符类型',
                  <select
                    className="input"
                    value={selectedToken.value}
                    onChange={(event) => updateSelectedOperatorToken(event.target.value as LogicalOperator)}
                  >
                    <option value="!">!</option>
                    <option value="&&">&&</option>
                    <option value="||">||</option>
                  </select>,
                  '运算符会按 Lua 语法优先级参与求值。'
                )}
                <div className="button-row">
                  <button type="button" className="button button--tonal" onClick={duplicateSelectedToken}>
                    复制运算符
                  </button>
                  <button type="button" className="button button--danger" onClick={removeSelectedToken}>
                    删除运算符
                  </button>
                </div>
              </div>
            ) : (
              <div className="editor-card">
                <h3 className="editor-card__title">括号</h3>
                {fieldRow(
                  '括号类型',
                  <select
                    className="input"
                    value={selectedToken.value}
                    onChange={(event) => updateSelectedParenToken(event.target.value as LogicalParen)}
                  >
                    <option value="(">(</option>
                    <option value=")">)</option>
                  </select>,
                  '括号可以把一段表达式单独分组。'
                )}
                <div className="button-row">
                  <button type="button" className="button button--tonal" onClick={duplicateSelectedToken}>
                    复制括号
                  </button>
                  <button type="button" className="button button--danger" onClick={removeSelectedToken}>
                    删除括号
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

          <section className="editor-card logical-rule-workbench__cache logical-rule-workbench__cache--hidden">
          <div className="logical-rule-workbench__section-header">
            <div>
              <h3 className="editor-card__title">缓存库</h3>
              <p className="logical-rule-workbench__section-copy">{cacheSummary}</p>
            </div>
          </div>

          <div className="logical-cache-list">
            {cacheState.items.length === 0 ? (
              <div className="empty-state empty-state--compact">暂无缓存的命令实例。</div>
            ) : (
              cacheState.items.map((item) => {
                const isLinked = selectedToken?.type === 'command' && selectedToken.cacheId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`logical-cache-item${item.pinned ? ' is-pinned' : ''}${isLinked ? ' is-linked' : ''}`}
                    role="button"
                    tabIndex={0}
                    draggable
                    onClick={() =>
                      insertCacheSnapshot({
                        name: item.name,
                        args: item.args
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        insertCacheSnapshot({
                          name: item.name,
                          args: item.args
                        });
                      }
                    }}
                    onDragStart={(event) => {
                      dragSourceRef.current = { kind: 'cache', cacheId: item.id };
                      event.dataTransfer.effectAllowed = 'copyMove';
                      event.dataTransfer.setData('text/plain', item.id);
                    }}
                    onDragEnd={() => {
                      dragSourceRef.current = null;
                      setActiveSlotIndex(null);
                    }}
                  >
                    <span className="logical-cache-item__title">{formatLogicalCommandCacheItem(item, userConfig.lang)}</span>
                    <span className="logical-cache-item__meta">
                      {item.pinned ? '已固定' : '自动缓存'}
                      {isLinked ? ' · 当前使用中' : ''}
                    </span>
                    <div className="logical-cache-item__actions">
                      <button
                        type="button"
                        className="button button--tonal button--compact"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCacheState((current) => toggleLogicalCommandCachePin(current, item.id));
                        }}
                      >
                        {item.pinned ? '取消固定' : '固定'}
                      </button>
                      <button
                        type="button"
                        className="button button--danger button--compact"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCacheState((current) => deleteLogicalCommandCacheEntry(current, item.id));
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="logical-rule-workbench__cache-settings">
            {fieldRow(
              '自动缓存上限',
              <input
                className="input input--compact"
                type="number"
                min={0}
                value={cacheState.maxItems}
                onChange={(event) => {
                  const nextLimit = Number(event.target.value);
                  setCacheState((current) =>
                    setLogicalCommandCacheLimit(current, Number.isFinite(nextLimit) ? nextLimit : 0)
                  );
                }}
              />,
              '未固定的缓存项会按最近使用顺序保留。'
            )}
          </div>
        </section>
        </div>

      </div>
          </section>

          <section
            role="tabpanel"
            id="logical-rule-panel-metadata"
            aria-labelledby="logical-rule-tab-metadata"
            hidden={activeTab !== 'metadata'}
            className="logical-rule-tab-panel logical-rule-tab-panel--metadata"
          >
            <div className="editor-card logical-rule-metadata-panel">
              <div className="logical-rule-workbench__section-header">
                <div>
                  <h3 className="editor-card__title">规则元数据编辑</h3>
                  <p className="logical-rule-workbench__section-copy">调整启用状态和规则注释。</p>
                </div>
                <div className="chip chip--path">
                  {groupRole || '未命名角色组'}
                  {mode === 'create' ? ' / 新建规则' : ' / 编辑规则'}
                </div>
              </div>

              <div className="logical-rule-workbench__meta">
                {fieldRow(
                  '启用状态',
                  <label className="export-panel__toggle rule-toggle">
                    <input
                      type="checkbox"
                      checked={ruleDraft.enable}
                      onChange={(event) =>
                        setRuleDraft((current) => ({
                          ...current,
                          enable: event.target.checked
                        }))
                      }
                    />
                    <span>启用这条规则</span>
                  </label>,
                  '关闭后规则仍会保留，但不会参与判断。'
                )}

                {fieldRow(
                  '注释',
                  <textarea
                    className="input"
                    rows={3}
                    value={ruleDraft.comments}
                    onChange={(event) =>
                      setRuleDraft((current) => ({
                        ...current,
                        comments: event.target.value
                      }))
                    }
                    placeholder="可选，填写后会在列表里优先显示"
                  />,
                  '注释不会影响逻辑判断，只是帮助后续维护。'
                )}
              </div>
            </div>
          </section>

          <section
            role="tabpanel"
            id="logical-rule-panel-manual"
            aria-labelledby="logical-rule-tab-manual"
            hidden={activeTab !== 'manual'}
            className="logical-rule-tab-panel logical-rule-tab-panel--manual"
          >
            <div className="editor-card logical-rule-manual-panel">
              <div className="logical-rule-workbench__section-header">
                <div>
                  <h3 className="editor-card__title">手动设置规则</h3>
                  <p className="logical-rule-workbench__section-copy">直接编辑完整逻辑表达式，保存前会做语法校验。</p>
                </div>
                <div className="chip chip--path">
                  {groupRole || '未命名角色组'}
                  {mode === 'create' ? ' / 新建规则' : ' / 编辑规则'}
                </div>
              </div>

              {fieldRow(
                '规则文本',
                <textarea
                  className="input logical-rule-manual-panel__textarea"
                  rows={18}
                  value={ruleDraft.rule}
                  onChange={(event) => handleManualRuleChange(event.target.value)}
                  placeholder="例如：{check-item: minecraft:stone#0 >= 64} && !{print: debug}"
                />,
                '可以直接输入完整逻辑规则文本。'
              )}
            </div>
          </section>
        </div>
      </div>

      {tokenContextMenu ? (
        <div className="logical-token-context-scrim" onClick={closeTokenContextMenu} onContextMenu={(event) => event.preventDefault()}>
          <div
            className="logical-token-context-menu"
            role="menu"
            style={{
              left: tokenContextMenu.x,
              top: tokenContextMenu.y
            }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
              <button
                type="button"
                className="logical-token-context-menu__item"
                onClick={() => {
                  openCommandInfoForToken(tokenContextMenu.tokenId);
                }}
              >
                信息
              </button>
              <button
                type="button"
                className="logical-token-context-menu__item"
                onClick={() => {
                  openCommandEditorForToken(tokenContextMenu.tokenId);
                }}
              >
                编辑
              </button>
          </div>
        </div>
      ) : null}

      <LogicalCommandTokenInfoModal
        open={Boolean(commandInfoCommandToken)}
        token={commandInfoCommandToken}
        cacheState={cacheState}
        onClose={() => setCommandInfoTokenId(null)}
      />

      <LogicalCommandTokenEditorModal
        open={Boolean(editingCommandToken)}
        token={editingCommandToken}
        onClose={() => setCommandEditorTokenId(null)}
        onSave={(next) => {
          if (!commandEditorTokenId) {
            return;
          }

          updateCommandTokenById(commandEditorTokenId, next.name, next.args);
          setCommandEditorTokenId(null);
        }}
      />
    </Modal>
  );
}
