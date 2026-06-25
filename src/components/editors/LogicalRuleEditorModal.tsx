import { useEffect, useMemo, useState } from 'react';
import type { FilterGroup, FilterRuleEntry } from '../../lib/OreConfigManager';
import { cloneFilterGroups, formatFilterRuleLabel } from '../../lib/OreConfigManager';
import { Modal } from '../Modal';
import { fieldRow } from './shared';
import { LogicalRuleDetailModal } from './LogicalRuleDetailModal';
import { validateLogicalExpression } from '../../lib/logical/LogicalRules';
import { Config } from '../../config';

interface LogicalRuleEditorModalProps {
  open: boolean;
  groups: FilterGroup[];
  availableRoles: string[];
  userConfig: Config;
  onClose: () => void;
  onSave: (groups: FilterGroup[]) => void;
}

export interface LogicalRuleEditorState {
  type: 'logicalRules';
}

interface RuleEditorState {
  groupIndex: number;
  ruleIndex: number | null;
  mode: 'create' | 'edit';
  initialRule: FilterRuleEntry;
}

function createEmptyRuleDraft(): FilterRuleEntry {
  return {
    rule: '',
    enable: true,
    comments: ''
  };
}

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}...`;
}

export function LogicalRuleEditorModal({
  open,
  groups,
  availableRoles,
  userConfig,
  onClose,
  onSave
}: LogicalRuleEditorModalProps) {
  const [draft, setDraft] = useState<FilterGroup[]>([]);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  const [newGroupRole, setNewGroupRole] = useState('');
  const [error, setError] = useState('');
  const [ruleEditor, setRuleEditor] = useState<RuleEditorState | null>(null);

  const roleOptions = useMemo(() => availableRoles, [availableRoles]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextDraft = cloneFilterGroups(groups);
    setDraft(nextDraft);
    setSelectedGroupIndex(nextDraft.length > 0 ? 0 : null);
    setNewGroupRole(roleOptions[0] ?? '');
    setError('');
    setRuleEditor(null);
  }, [open, groups, roleOptions]);

  const selectedGroup = selectedGroupIndex !== null ? draft[selectedGroupIndex] ?? null : null;

  const selectGroup = (groupIndex: number) => {
    if (!draft[groupIndex]) {
      return;
    }

    setSelectedGroupIndex(groupIndex);
    setError('');
  };

  const addGroup = () => {
    if (availableRoles.length === 0) {
      setError('当前没有可用角色');
      return;
    }

    const role = newGroupRole.trim();
    if (!role) {
      setError('请选择角色');
      return;
    }

    if (!availableRoles.includes(role)) {
      setError('角色必须来自当前配置');
      return;
    }

    if (draft.some((group) => group.role === role)) {
      setError(`角色组 "${role}" 已存在`);
      return;
    }

    const nextDraft = [...draft, { role, rules: [] }];
    setDraft(nextDraft);
    setSelectedGroupIndex(nextDraft.length - 1);
    setError('');
  };

  const deleteSelectedGroup = () => {
    if (selectedGroupIndex === null) {
      return;
    }

    const group = draft[selectedGroupIndex];
    if (!group) {
      return;
    }

    if (!window.confirm(`确定删除角色组 "${group.role}" 吗？`)) {
      return;
    }

    const nextDraft = draft.filter((_, index) => index !== selectedGroupIndex);
    setDraft(nextDraft);
    setSelectedGroupIndex(nextDraft.length === 0 ? null : Math.min(selectedGroupIndex, nextDraft.length - 1));
    setError('');
  };

  const openRuleEditorForCreate = (groupIndex: number) => {
    const group = draft[groupIndex];
    if (!group) {
      return;
    }

    setSelectedGroupIndex(groupIndex);
    setRuleEditor({
      groupIndex,
      ruleIndex: null,
      mode: 'create',
      initialRule: createEmptyRuleDraft()
    });
    setError('');
  };

  const openRuleEditorForEdit = (groupIndex: number, ruleIndex: number) => {
    const rule = draft[groupIndex]?.rules[ruleIndex];
    if (!rule) {
      return;
    }

    setSelectedGroupIndex(groupIndex);
    setRuleEditor({
      groupIndex,
      ruleIndex,
      mode: 'edit',
      initialRule: {
        rule: rule.rule,
        enable: rule.enable,
        comments: rule.comments
      }
    });
    setError('');
  };

  const deleteRule = (groupIndex: number, ruleIndex: number) => {
    const group = draft[groupIndex];
    const rule = group?.rules[ruleIndex];
    if (!group || !rule) {
      return;
    }

    if (!window.confirm(`确定删除逻辑规则 "${formatFilterRuleLabel(rule)}" 吗？`)) {
      return;
    }

    const nextDraft = draft.map((entry, index) =>
      index === groupIndex
        ? {
            ...entry,
            rules: entry.rules.filter((_, currentRuleIndex) => currentRuleIndex !== ruleIndex)
          }
        : entry
    );

    setDraft(nextDraft);
    setSelectedGroupIndex(groupIndex);
    setError('');
  };

  const handleRuleEditorSave = (nextRule: FilterRuleEntry) => {
    if (!ruleEditor) {
      return;
    }

    const nextDraft = draft.map((group, groupIndex) => {
      if (groupIndex !== ruleEditor.groupIndex) {
        return group;
      }

      if (ruleEditor.mode === 'create') {
        return {
          ...group,
          rules: [...group.rules, nextRule]
        };
      }

      return {
        ...group,
        rules: group.rules.map((rule, ruleIndex) => (ruleIndex === ruleEditor.ruleIndex ? nextRule : rule))
      };
    });

    setDraft(nextDraft);
    setSelectedGroupIndex(ruleEditor.groupIndex);
    setRuleEditor(null);
  };

  const handleSave = () => {
    const nextGroups = cloneFilterGroups(draft);

    for (const group of nextGroups) {
      const role = group.role.trim();
      if (!role) {
        setError('角色组名称不能为空');
        return;
      }

      if (!roleOptions.includes(role)) {
        setError(`角色 "${role}" 不在当前配置中`);
        return;
      }

      group.role = role;

      const seen = new Set<string>();
      for (const rule of group.rules) {
        const nextRuleText = rule.rule.trim();
        if (!nextRuleText) {
          setError(`角色组 "${role}" 中存在空规则`);
          return;
        }

        try {
          validateLogicalExpression(nextRuleText);
        } catch (validationError) {
          setError(
            `角色组 "${role}" 中的表达式 "${truncateText(nextRuleText, 48)}" 无法保存: ${
              validationError instanceof Error ? validationError.message : String(validationError)
            }`
          );
          return;
        }

        if (seen.has(nextRuleText)) {
          setError(`角色组 "${role}" 中存在重复表达式`);
          return;
        }

        seen.add(nextRuleText);
        rule.rule = nextRuleText;
        rule.comments = rule.comments.trim();
      }
    }

    onSave(nextGroups);
  };

  const footer = (
    <>
      <button type="button" className="button button--tonal" onClick={onClose}>
        取消
      </button>
      <button type="button" className="button button--filled" onClick={handleSave}>
        保存
      </button>
    </>
  );

  return (
    <>
      <Modal
        open={open}
        title="逻辑规则编辑器"
        subtitle="这里只负责角色组和规则摘要。点击“新增规则”会再打开一个独立的规则编辑弹窗。"
        sheetClassName="modal-sheet--logical-groups"
        closeOnEscape={!ruleEditor}
        onClose={onClose}
        footer={footer}
      >
        <div className="logical-group-studio">
          <div className="editor-card logical-group-studio__toolbar">
            <div className="logical-group-studio__section-header">
              <div>
                <h3 className="editor-card__title">角色组</h3>
                <p className="logical-group-studio__section-copy">每个角色组对应一组逻辑规则。</p>
              </div>
              <span className="chip chip--soft">{draft.length} 组</span>
            </div>

            {fieldRow(
              '新增角色组',
              <div className="field-control field-control--stack">
                <select
                  className="input input--compact"
                  value={newGroupRole}
                  onChange={(event) => setNewGroupRole(event.target.value)}
                  disabled={roleOptions.length === 0}
                >
                  {roleOptions.length === 0 ? (
                    <option value="">暂无可用角色</option>
                  ) : (
                    <>
                      <option value="" disabled>
                        选择角色
                      </option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <button
                  type="button"
                  className="button button--filled button--compact"
                  onClick={addGroup}
                  disabled={roleOptions.length === 0}
                >
                  添加角色组
                </button>
              </div>,
              roleOptions.length === 0
                ? '当前没有可用角色，无法创建新的逻辑规则组。'
                : '先选一个角色，再创建或编辑它对应的逻辑规则。'
            )}
          </div>

          <div className="logical-rule-studio__group-list">
            {draft.length === 0 ? (
              <div className="empty-state empty-state--compact">
                <strong>尚未创建任何角色组</strong>
                <span>先在上方选择一个角色并添加分组。</span>
              </div>
            ) : (
              draft.map((group, groupIndex) => {
                const isSelected = selectedGroupIndex === groupIndex;
                return (
                  <div
                    key={group.role}
                    className={`logical-rule-studio__group-card${isSelected ? ' is-selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectGroup(groupIndex)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectGroup(groupIndex);
                      }
                    }}
                  >
                    <div className="logical-rule-studio__group-head">
                      <div className="logical-rule-studio__group-head-row">
                        <div className="logical-rule-studio__group-title">
                          {isSelected ? (
                            <input
                              className="input input--compact logical-rule-studio__group-role"
                              value={group.role}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                const nextRole = event.target.value;
                                setDraft((current) =>
                                  current.map((entry, index) =>
                                    index === groupIndex ? { ...entry, role: nextRole } : entry
                                  )
                                );
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  selectGroup(groupIndex);
                                }
                              }}
                            />
                          ) : (
                            <strong className="record-card__title">{group.role}</strong>
                          )}
                          <span className="chip chip--meta">{group.rules.length} 条</span>
                        </div>

                        <div className="button-row">
                          <button
                            type="button"
                            className="button button--filled button--compact"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRuleEditorForCreate(groupIndex);
                            }}
                          >
                            新增规则
                          </button>
                          <button
                            type="button"
                            className="button button--danger button--compact"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (selectedGroupIndex === groupIndex) {
                                deleteSelectedGroup();
                              } else {
                                if (!window.confirm(`确定删除角色组 "${group.role}" 吗？`)) {
                                  return;
                                }

                                const nextDraft = draft.filter((_, index) => index !== groupIndex);
                                setDraft(nextDraft);
                                setSelectedGroupIndex(
                                  nextDraft.length === 0 ? null : Math.min(groupIndex, nextDraft.length - 1)
                                );
                              }
                            }}
                          >
                            删除组
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="logical-group-studio__rule-list">
                      {group.rules.length === 0 ? (
                        <div className="empty-state empty-state--compact">
                          <span>这个角色组还没有规则，点击“新增规则”开始编辑。</span>
                        </div>
                      ) : (
                        group.rules.map((rule, ruleIndex) => (
                          <div
                            key={`${group.role}-${ruleIndex}-${rule.rule}`}
                            className="logical-group-studio__rule-item"
                            role="button"
                            tabIndex={0}
                            onClick={() => openRuleEditorForEdit(groupIndex, ruleIndex)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openRuleEditorForEdit(groupIndex, ruleIndex);
                              }
                            }}
                          >
                            <div className="logical-group-studio__rule-item-main">
                              <div className="logical-group-studio__rule-item-label">
                                {formatFilterRuleLabel(rule)}
                              </div>
                              <div className="logical-group-studio__rule-item-badges">
                                <span className="logical-group-studio__badge">
                                  {rule.enable ? '启用' : '停用'}
                                </span>
                                {rule.comments.trim() ? (
                                  <span className="logical-group-studio__badge logical-group-studio__badge--soft">
                                    注释
                                  </span>
                                ) : null}
                              </div>
                              <div className="logical-group-studio__rule-item-preview">
                                {truncateText(rule.rule, 96)}
                              </div>
                            </div>

                            <div className="logical-group-studio__rule-item-actions">
                              <button
                                type="button"
                                className="button button--tonal button--compact"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRuleEditorForEdit(groupIndex, ruleIndex);
                                }}
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                className="button button--danger button--compact"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteRule(groupIndex, ruleIndex);
                                }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error ? <div className="form-error">{error}</div> : null}
        </div>
      </Modal>

      {ruleEditor && selectedGroup ? (
        <LogicalRuleDetailModal
          userConfig={userConfig}
          open
          mode={ruleEditor.mode}
          groupRole={selectedGroup.role}
          initialRule={ruleEditor.initialRule}
          onClose={() => setRuleEditor(null)}
          onSave={handleRuleEditorSave}
        />
      ) : null}
    </>
  );
}
