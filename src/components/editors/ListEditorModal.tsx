import { useEffect, useState } from 'react';
import { cloneFilterGroups, formatFilterRuleLabel, type FilterGroup, type FilterRuleEntry } from '../../lib/OreConfigManager';
import { Modal } from '../Modal';
import { fieldRow } from './shared';
import { ITEM_RESOURCE_PICKER_SPEC, ResourcePickerModal } from '../resourcePicker';

type Selection =
  | {
      kind: 'group';
      index: number;
    }
  | {
      kind: 'rule';
      groupIndex: number;
      ruleIndex: number;
    }
  | null;

interface ListEditorModalProps {
  open: boolean;
  title: string;
  groups: FilterGroup[];
  availableRoles: string[];
  onClose: () => void;
  onSave: (groups: FilterGroup[]) => void;
}

export interface ListEditorState {
  type: 'list';
  kind: 'idWhitelist' | 'idBlacklist';
}

function createEmptyRuleDraft(): FilterRuleEntry {
  return {
    rule: '',
    enable: true,
    comments: ''
  };
}

function cloneRuleDraft(rule: FilterRuleEntry): FilterRuleEntry {
  return {
    rule: rule.rule,
    enable: rule.enable,
    comments: rule.comments
  };
}

export function ListEditorModal({
  open,
  title,
  groups,
  availableRoles,
  onClose,
  onSave
}: ListEditorModalProps) {
  const [draft, setDraft] = useState<FilterGroup[]>([]);
  const [selected, setSelected] = useState<Selection>(null);
  const [newGroupRole, setNewGroupRole] = useState('');
  const [groupDraft, setGroupDraft] = useState('');
  const [newRuleDraft, setNewRuleDraft] = useState<FilterRuleEntry>(createEmptyRuleDraft());
  const [ruleDraft, setRuleDraft] = useState<FilterRuleEntry>(createEmptyRuleDraft());
  const [error, setError] = useState('');
  const [openItemPicker, setOpenItemPicker] = useState(false)

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextDraft = cloneFilterGroups(groups);
    setDraft(nextDraft);
    setSelected(nextDraft[0] ? { kind: 'group', index: 0 } : null);
    setNewGroupRole(availableRoles[0] || '');
    setGroupDraft(nextDraft[0]?.role ?? availableRoles[0] ?? '');
    setNewRuleDraft(createEmptyRuleDraft());
    setRuleDraft(nextDraft[0]?.rules[0] ? cloneRuleDraft(nextDraft[0].rules[0]) : createEmptyRuleDraft());
    setError('');
  }, [open, groups, availableRoles]);

  useEffect(() => {
    if (!open || !selected) {
      return;
    }

    if (selected.kind === 'group') {
      const group = draft[selected.index];
      if (!group) {
        setSelected(draft[0] ? { kind: 'group', index: 0 } : null);
        return;
      }

      setGroupDraft(group.role);
      setNewRuleDraft(createEmptyRuleDraft());
      return;
    }

    const group = draft[selected.groupIndex];
    const rule = group?.rules[selected.ruleIndex];
    if (!rule) {
      setSelected({ kind: 'group', index: selected.groupIndex });
      return;
    }

    setRuleDraft(cloneRuleDraft(rule));
  }, [open, selected, draft]);

  const isRoleAllowed = (role: string) => availableRoles.includes(role);

  const addGroup = () => {
    if (availableRoles.length === 0) {
      setError('当前没有可用职责');
      return;
    }

    const role = newGroupRole.trim();
    if (!role) {
      setError('请选择职责');
      return;
    }

    if (!isRoleAllowed(role)) {
      setError('职责必须来自当前配置');
      return;
    }

    if (draft.some((group) => group.role === role)) {
      setError(`职责组 "${role}" 已存在`);
      return;
    }

    const next = [...draft, { role, rules: [] }];
    setDraft(next);
    setSelected({ kind: 'group', index: next.length - 1 });
    setGroupDraft(role);
    setNewRuleDraft(createEmptyRuleDraft());
    setError('');
  };

  const renameGroup = () => {
    if (!selected || selected.kind !== 'group') {
      return;
    }

    const role = groupDraft.trim();
    if (!role) {
      setError('职责名称不能为空');
      return;
    }

    if (!isRoleAllowed(role)) {
      setError('职责必须来自当前配置');
      return;
    }

    if (draft.some((group, index) => index !== selected.index && group.role === role)) {
      setError(`职责组 "${role}" 已存在`);
      return;
    }

    setDraft((current) =>
      current.map((group, index) => (index === selected.index ? { ...group, role } : group))
    );
    setError('');
  };

  const addRule = () => {
    if (!selected || selected.kind !== 'group') {
      return;
    }

    const group = draft[selected.index];
    if (!group) {
      return;
    }

    const nextRule = {
      rule: newRuleDraft.rule.trim(),
      enable: newRuleDraft.enable,
      comments: newRuleDraft.comments.trim()
    };

    if (!nextRule.rule) {
      setError('规则文本不能为空');
      return;
    }

    if (group.rules.some((entry) => entry.rule === nextRule.rule)) {
      setError(`规则 "${nextRule.rule}" 已存在于当前职责组`);
      return;
    }

    const nextIndex = group.rules.length;
    const next = draft.map((entry, index) =>
      index === selected.index ? { ...entry, rules: [...entry.rules, nextRule] } : entry
    );

    setDraft(next);
    setSelected({ kind: 'rule', groupIndex: selected.index, ruleIndex: nextIndex });
    setRuleDraft(nextRule);
    setNewRuleDraft(createEmptyRuleDraft());
    setError('');
  };

  const renameRule = () => {
    if (!selected || selected.kind !== 'rule') {
      return;
    }

    const group = draft[selected.groupIndex];
    if (!group) {
      return;
    }

    const nextRule = {
      rule: ruleDraft.rule.trim(),
      enable: ruleDraft.enable,
      comments: ruleDraft.comments.trim()
    };

    if (!nextRule.rule) {
      setError('规则文本不能为空');
      return;
    }

    if (group.rules.some((entry, index) => index !== selected.ruleIndex && entry.rule === nextRule.rule)) {
      setError(`规则 "${nextRule.rule}" 已存在于当前职责组`);
      return;
    }

    setDraft((current) =>
      current.map((entry, groupIndex) =>
        groupIndex === selected.groupIndex
          ? {
              ...entry,
              rules: entry.rules.map((rule, ruleIndex) =>
                ruleIndex === selected.ruleIndex ? nextRule : rule
              )
            }
          : entry
      )
    );
    setRuleDraft(nextRule);
    setError('');
  };

  const deleteSelectedGroup = () => {
    if (!selected || selected.kind !== 'group') {
      return;
    }

    const group = draft[selected.index];
    if (!group) {
      return;
    }

    if (!window.confirm(`确认删除职责组 "${group.role}" 吗？`)) {
      return;
    }

    const next = draft.filter((_, index) => index !== selected.index);
    setDraft(next);
    setSelected(next[0] ? { kind: 'group', index: 0 } : null);
    setGroupDraft(next[0]?.role ?? availableRoles[0] ?? '');
    setNewRuleDraft(createEmptyRuleDraft());
    setRuleDraft(next[0]?.rules[0] ? cloneRuleDraft(next[0].rules[0]) : createEmptyRuleDraft());
    setError('');
  };

  const deleteSelectedRule = () => {
    if (!selected || selected.kind !== 'rule') {
      return;
    }

    const group = draft[selected.groupIndex];
    const rule = group?.rules[selected.ruleIndex];
    if (!group || !rule) {
      return;
    }

    if (!window.confirm(`确认删除规则 "${formatFilterRuleLabel(rule)}" 吗？`)) {
      return;
    }

    const next = draft.map((entry, groupIndex) =>
      groupIndex === selected.groupIndex
        ? {
            ...entry,
            rules: entry.rules.filter((_, ruleIndex) => ruleIndex !== selected.ruleIndex)
          }
        : entry
    );

    setDraft(next);
    setSelected({ kind: 'group', index: selected.groupIndex });
    setNewRuleDraft(createEmptyRuleDraft());
    setRuleDraft(
      next[selected.groupIndex]?.rules[0] ? cloneRuleDraft(next[selected.groupIndex].rules[0]) : createEmptyRuleDraft()
    );
    setError('');
  };

  return (
    <Modal
      open={open}
      title={title}
      subtitle="支持对职责组内规则进行新增、编辑、启用和注释维护，保存后会直接写回 Lua 配置。"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--tonal" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button button--filled" onClick={() => onSave(draft)}>
            保存
          </button>
        </>
      }
    >
      <div className="list-editor">
        <div className="list-editor__sidebar">
          <div className="toolbar toolbar--compact">
            <span className="toolbar__label">新增职责组</span>
            <select
              className="input input--compact"
              value={newGroupRole}
              onChange={(event) => setNewGroupRole(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addGroup();
                }
              }}
              disabled={availableRoles.length === 0}
            >
              {availableRoles.length === 0 ? (
                <option value="">暂无可选职责</option>
              ) : (
                <>
                  <option value="" disabled>
                    选择职责
                  </option>
                  {availableRoles.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </>
              )}
            </select>
            <button
              type="button"
              className="button button--tonal button--compact"
              onClick={addGroup}
              disabled={availableRoles.length === 0}
            >
              添加
            </button>
          </div>

          <div className="tree-root">
            <div className="tree-root__title">{title}</div>
            {draft.length === 0 ? (
              <div className="empty-state empty-state--compact">暂无职责组</div>
            ) : (
              draft.map((group, groupIndex) => {
                const groupActive = selected?.kind === 'group' && selected.index === groupIndex;
                return (
                  <section
                    key={`${group.role}-${groupIndex}`}
                    className={`tree-group${groupActive ? ' is-selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="tree-group__header"
                      onClick={() => setSelected({ kind: 'group', index: groupIndex })}
                    >
                      <span>{group.role}</span>
                      <span className="tree-group__count">{group.rules.length}</span>
                    </button>
                    <div className="tree-group__items">
                      {group.rules.length === 0 ? (
                        <span className="tree-group__empty">空</span>
                      ) : (
                        group.rules.map((rule, ruleIndex) => {
                          const itemActive =
                            selected?.kind === 'rule' &&
                            selected.groupIndex === groupIndex &&
                            selected.ruleIndex === ruleIndex;
                          return (
                            <button
                              type="button"
                              key={`${group.role}-${rule.rule}-${ruleIndex}`}
                              className={`tree-item${itemActive ? ' is-selected' : ''}${
                                rule.enable ? '' : ' tree-item--disabled'
                              }`}
                              onClick={() => setSelected({ kind: 'rule', groupIndex, ruleIndex })}
                              title={`规则: ${rule.rule}${
                                rule.comments.trim() ? `\n注释: ${rule.comments.trim()}` : ''
                              }\n状态: ${rule.enable ? '启用' : '停用'}`}
                            >
                              <span className="tree-item__label">{formatFilterRuleLabel(rule)}</span>
                              <span
                                className={`tree-item__status${
                                  rule.enable ? ' tree-item__status--on' : ' tree-item__status--off'
                                }`}
                              >
                                {rule.enable ? '启用' : '停用'}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>

        <div className="list-editor__detail">
          {!selected ? (
            <div className="empty-state">
              <strong>尚未选择节点</strong>
              <span>先在左侧选择一个职责组或规则，再在这里编辑。</span>
            </div>
          ) : selected.kind === 'group' ? (
            <div className="editor-card">
              <h3 className="editor-card__title">职责组</h3>
              {fieldRow(
                '职责名称',
                <input
                  className="input"
                  value={groupDraft}
                  onChange={(event) => setGroupDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      renameGroup();
                    }
                  }}
                  placeholder="输入职责名称"
                />,
                '重命名后会直接替换该组对应的 key。'
              )}
              <div className="resource-picker-control__row">
                {fieldRow(
                  '规则文本',
                  <input
                    className="input"
                    value={newRuleDraft.rule}
                    onChange={(event) =>
                      setNewRuleDraft((current) => ({ ...current, rule: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addRule()
                      }
                    }}
                    placeholder="输入规则文本"
                  />,
                  '规则文本是物品的ID。'
                )}
                <button type="button" className="button button--tonal button--compact" onClick={() => setOpenItemPicker(true)}>
                  选择
                </button>
                {openItemPicker ? (
                  <ResourcePickerModal
                    spec={ITEM_RESOURCE_PICKER_SPEC}
                    currentValue={newRuleDraft.rule}
                    valueMode={'id'}
                    onClose={() => setOpenItemPicker(false)}
                    onSelect={(nextValue, record) => {
                      setNewRuleDraft((current) => ({ ...current, rule: nextValue, comments: current.comments || record.localizedName }))
                      setOpenItemPicker(false);
                    }}
                  />
                ) : null}
              </div>
              {fieldRow(
                '是否启用',
                <label className="export-panel__toggle rule-toggle">
                  <input
                    type="checkbox"
                    checked={newRuleDraft.enable}
                    onChange={(event) =>
                      setNewRuleDraft((current) => ({ ...current, enable: event.target.checked }))
                    }
                  />
                  <span>启用</span>
                </label>
              )}
              {fieldRow(
                '注释',
                <textarea
                  className="input"
                  rows={3}
                  value={newRuleDraft.comments}
                  onChange={(event) =>
                    setNewRuleDraft((current) => ({ ...current, comments: event.target.value }))
                  }
                  placeholder="可选，填写后优先展示这段文字"
                />,
                '新增规则时可以直接录入说明。'
              )}
              <div className="button-row">
                <button type="button" className="button button--filled" onClick={renameGroup}>
                  重命名职责组
                </button>
                <button type="button" className="button button--tonal" onClick={addRule}>
                  添加规则
                </button>
                <button type="button" className="button button--danger" onClick={deleteSelectedGroup}>
                  删除职责组
                </button>
              </div>
            </div>
          ) : (
            <div className="editor-card">
              <h3 className="editor-card__title">规则</h3>
              <div className="resource-picker-control__row">
                {fieldRow(
                  '规则文本',
                  <input
                    className="input"
                    value={ruleDraft.rule}
                    onChange={(event) =>
                      setRuleDraft((current) => ({ ...current, rule: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        renameRule();
                      }
                    }}
                    placeholder="输入规则文本"
                  />,
                  '规则文本是物品的ID。'
                )}
                <button type="button" className="button button--tonal button--compact" onClick={() => setOpenItemPicker(true)}>
                  选择
                </button>
                {openItemPicker ? (
                  <ResourcePickerModal
                    spec={ITEM_RESOURCE_PICKER_SPEC}
                    currentValue={ruleDraft.rule}
                    valueMode={'id'}
                    onClose={() => setOpenItemPicker(false)}
                    onSelect={(nextValue, record) => {
                      setRuleDraft((current) => ({ ...current, rule: nextValue, comments: current.comments || record.localizedName }))
                      setOpenItemPicker(false);
                    }}
                  />
                ) : null}
              </div>
              {fieldRow(
                '是否启用',
                <label className="export-panel__toggle rule-toggle">
                  <input
                    type="checkbox"
                    checked={ruleDraft.enable}
                    onChange={(event) =>
                      setRuleDraft((current) => ({ ...current, enable: event.target.checked }))
                    }
                  />
                  <span>启用</span>
                </label>
              )}
              {fieldRow(
                '注释',
                <textarea
                  className="input"
                  rows={3}
                  value={ruleDraft.comments}
                  onChange={(event) =>
                    setRuleDraft((current) => ({ ...current, comments: event.target.value }))
                  }
                  placeholder="如果填写，列表中会优先显示这段注释"
                />,
                '注释优先显示，便于区分规则用途。'
              )}
              <div className="button-row">
                <button type="button" className="button button--filled" onClick={renameRule}>
                  保存规则
                </button>
                <button type="button" className="button button--danger" onClick={deleteSelectedRule}>
                  删除规则
                </button>
              </div>
            </div>
          )}

          {error ? <div className="form-error">{error}</div> : null}
        </div>
      </div>
    </Modal>
  );
}
