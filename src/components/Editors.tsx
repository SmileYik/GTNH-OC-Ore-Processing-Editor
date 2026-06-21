import { useEffect, useState, type ReactNode } from 'react';
import { cloneFilterGroups, type FilterGroup, type InterfaceEntry, type RoleEntry } from '../lib/OreConfigManager';
import { Modal } from './Modal';

function fieldRow(label: string, children: ReactNode, hint?: string) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-control">{children}</div>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

interface RoleEditorModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initial: RoleEntry;
  existingNames: string[];
  onClose: () => void;
  onSave: (next: RoleEntry) => void;
}

export function RoleEditorModal({
  open,
  mode,
  initial,
  existingNames,
  onClose,
  onSave
}: RoleEditorModalProps) {
  const [name, setName] = useState(initial.name);
  const [machine, setMachine] = useState(initial.machine);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(initial.name);
    setMachine(initial.machine);
    setError('');
  }, [open, initial]);

  const save = () => {
    const nextName = name.trim();
    const nextMachine = machine.trim();

    if (!nextName) {
      setError('职责名称不能为空');
      return;
    }

    if (!nextMachine) {
      setError('机器名称不能为空');
      return;
    }

    if (existingNames.some((entry) => entry !== initial.name && entry === nextName)) {
      setError(`职责 "${nextName}" 已存在`);
      return;
    }

    onSave({ name: nextName, machine: nextMachine });
  };

  return (
    <Modal
      open={open}
      title={mode === 'add' ? '新增职责' : '编辑职责'}
      subtitle="职责名称会联动更新到流程、输出口和黑白名单。"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--tonal" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button button--filled" onClick={save}>
            保存
          </button>
        </>
      }
    >
      <div className="modal-form">
        {fieldRow(
          '职责名称',
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            placeholder="例如：粉碎"
          />,
          '职责名称会作为流程节点的 key。'
        )}

        {fieldRow(
          '机器名称',
          <input
            className="input"
            value={machine}
            onChange={(event) => setMachine(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            placeholder="例如：粉碎机"
          />,
          '这里保存对应的具体操作机器名称。'
        )}

        {error ? <div className="form-error">{error}</div> : null}
      </div>
    </Modal>
  );
}

interface InterfaceEditorModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initial: InterfaceEntry;
  availableRoles: string[];
  existingIds: string[];
  onClose: () => void;
  onSave: (next: InterfaceEntry) => void;
}

export function InterfaceEditorModal({
  open,
  mode,
  initial,
  availableRoles,
  existingIds,
  onClose,
  onSave
}: InterfaceEditorModalProps) {
  const [id, setId] = useState(initial.id);
  const [role, setRole] = useState(initial.role);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setId(initial.id);
    setRole(initial.role || availableRoles[0] || '');
    setError('');
  }, [open, initial, availableRoles]);

  const save = () => {
    const nextId = id.trim();
    const nextRole = role.trim();

    if (!nextId) {
      setError('输出口 ID 不能为空');
      return;
    }

    if (!nextRole) {
      setError('职责不能为空');
      return;
    }

    if (!availableRoles.includes(nextRole)) {
      setError('职责必须来自当前配置');
      return;
    }

    if (existingIds.some((entry) => entry !== initial.id && entry === nextId)) {
      setError(`输出口 "${nextId}" 已存在`);
      return;
    }

    onSave({ id: nextId, role: nextRole });
  };

  return (
    <Modal
      open={open}
      title={mode === 'add' ? '新增输出口' : '编辑输出口'}
      subtitle="输出口 ID 需要唯一，并且要指向一个职责。"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--tonal" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button button--filled" onClick={save}>
            保存
          </button>
        </>
      }
    >
      <div className="modal-form">
        {fieldRow(
          '输出口 ID',
          <input
            className="input"
            value={id}
            onChange={(event) => setId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            placeholder="例如：c6220ff-e6bb-452f-b505-ec45ac813170"
          />,
          '这里是输出口表中的 key。'
        )}

        {fieldRow(
          '职责',
          <select
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            disabled={availableRoles.length === 0}
          >
            {availableRoles.length === 0 ? (
              <option value="">暂无可用职责</option>
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
          </select>,
          '只能从当前配置中的职责里选择。'
        )}

        {error ? <div className="form-error">{error}</div> : null}
      </div>
    </Modal>
  );
}

type Selection =
  | {
      kind: 'group';
      index: number;
    }
  | {
      kind: 'id';
      groupIndex: number;
      idIndex: number;
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
  const [newIdDraft, setNewIdDraft] = useState('');
  const [idDraft, setIdDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextDraft = cloneFilterGroups(groups);
    setDraft(nextDraft);
    setSelected(nextDraft[0] ? { kind: 'group', index: 0 } : null);
    setNewGroupRole(availableRoles[0] || '');
    setGroupDraft(nextDraft[0]?.role ?? availableRoles[0] ?? '');
    setNewIdDraft('');
    setIdDraft('');
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
      setNewIdDraft('');
      return;
    }

    const group = draft[selected.groupIndex];
    setIdDraft(group?.ids[selected.idIndex] ?? '');
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
      setError(`职责桶 "${role}" 已存在`);
      return;
    }

    const next = [...draft, { role, ids: [] }];
    setDraft(next);
    setSelected({ kind: 'group', index: next.length - 1 });
    setGroupDraft(role);
    setNewIdDraft('');
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
      setError(`职责桶 "${role}" 已存在`);
      return;
    }

    setDraft((current) =>
      current.map((group, index) => (index === selected.index ? { ...group, role } : group))
    );
    setError('');
  };

  const addId = () => {
    if (!selected || selected.kind !== 'group') {
      return;
    }

    const id = newIdDraft.trim();
    if (!id) {
      setError('请输入 ID');
      return;
    }

    if (draft.some((group) => group.ids.includes(id))) {
      setError(`ID "${id}" 已存在于当前列表中`);
      return;
    }

    setDraft((current) =>
      current.map((group, index) =>
        index === selected.index ? { ...group, ids: [...group.ids, id] } : group
      )
    );
    setNewIdDraft('');
    setError('');
  };

  const renameId = () => {
    if (!selected || selected.kind !== 'id') {
      return;
    }

    const id = idDraft.trim();
    if (!id) {
      setError('ID 不能为空');
      return;
    }

    if (
      draft.some((group, groupIndex) =>
        group.ids.some(
          (value, index) =>
            value === id && !(groupIndex === selected.groupIndex && index === selected.idIndex)
        )
      )
    ) {
      setError(`ID "${id}" 已存在于当前列表中`);
      return;
    }

    setDraft((current) =>
      current.map((group, groupIndex) =>
        groupIndex === selected.groupIndex
          ? {
              ...group,
              ids: group.ids.map((value, idIndex) => (idIndex === selected.idIndex ? id : value))
            }
          : group
      )
    );
    setError('');
  };

  const deleteSelectedGroup = () => {
    if (!selected || selected.kind !== 'group') {
      return;
    }

    if (!window.confirm(`确认删除职责桶 "${draft[selected.index]?.role ?? ''}" 吗？`)) {
      return;
    }

    const next = draft.filter((_, index) => index !== selected.index);
    setDraft(next);
    setSelected(next[0] ? { kind: 'group', index: 0 } : null);
    setGroupDraft(next[0]?.role ?? availableRoles[0] ?? '');
    setNewIdDraft('');
    setIdDraft('');
    setError('');
  };

  const deleteSelectedId = () => {
    if (!selected || selected.kind !== 'id') {
      return;
    }

    const group = draft[selected.groupIndex];
    const value = group?.ids[selected.idIndex];
    if (!value) {
      return;
    }

    if (!window.confirm(`确认删除 ID "${value}" 吗？`)) {
      return;
    }

    const next = draft.map((entry, groupIndex) =>
      groupIndex === selected.groupIndex
        ? { ...entry, ids: entry.ids.filter((_, idIndex) => idIndex !== selected.idIndex) }
        : entry
    );

    setDraft(next);
    setSelected({ kind: 'group', index: selected.groupIndex });
    setGroupDraft(next[selected.groupIndex]?.role ?? availableRoles[0] ?? '');
    setNewIdDraft('');
    setIdDraft('');
    setError('');
  };

  return (
    <Modal
      open={open}
      title={title}
      subtitle="支持对职责桶与 ID 做增删改，保存后会直接回写到 Lua 配置。"
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
            <span className="toolbar__label">新增职责桶</span>
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
              <div className="empty-state empty-state--compact">暂无职责桶</div>
            ) : (
              draft.map((group, groupIndex) => {
                const active = selected?.kind === 'group' && selected.index === groupIndex;
                return (
                  <section key={`${group.role}-${groupIndex}`} className={`tree-group${active ? ' is-selected' : ''}`}>
                    <button
                      type="button"
                      className="tree-group__header"
                      onClick={() => setSelected({ kind: 'group', index: groupIndex })}
                    >
                      <span>{group.role}</span>
                      <span className="tree-group__count">{group.ids.length}</span>
                    </button>
                    <div className="tree-group__items">
                      {group.ids.length === 0 ? (
                        <span className="tree-group__empty">空</span>
                      ) : (
                        group.ids.map((id, idIndex) => {
                          const itemActive =
                            selected?.kind === 'id' &&
                            selected.groupIndex === groupIndex &&
                            selected.idIndex === idIndex;
                          return (
                            <button
                              type="button"
                              key={`${id}-${idIndex}`}
                              className={`tree-item${itemActive ? ' is-selected' : ''}`}
                              onClick={() => setSelected({ kind: 'id', groupIndex, idIndex })}
                            >
                              {id}
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
              <span>先在左侧选择一个职责桶或 ID，再在这里编辑。</span>
            </div>
          ) : selected.kind === 'group' ? (
            <div className="editor-card">
              <h3 className="editor-card__title">职责桶</h3>
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
                '重命名后会直接替换该桶对应的 key。'
              )}
              {fieldRow(
                '新增 ID',
                <input
                  className="input"
                  value={newIdDraft}
                  onChange={(event) => setNewIdDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addId();
                    }
                  }}
                  placeholder="输入物品 ID"
                />,
                '新增的 ID 会写入当前职责桶。'
              )}
              <div className="button-row">
                <button type="button" className="button button--filled" onClick={renameGroup}>
                  重命名
                </button>
                <button type="button" className="button button--tonal" onClick={addId}>
                  添加 ID
                </button>
                <button type="button" className="button button--danger" onClick={deleteSelectedGroup}>
                  删除职责桶
                </button>
              </div>
            </div>
          ) : (
            <div className="editor-card">
              <h3 className="editor-card__title">ID</h3>
              {fieldRow(
                '当前值',
                <input
                  className="input"
                  value={idDraft}
                  onChange={(event) => setIdDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      renameId();
                    }
                  }}
                  placeholder="输入新的物品 ID"
                />,
                '修改后会回写到当前职责桶。'
              )}
              <div className="button-row">
                <button type="button" className="button button--filled" onClick={renameId}>
                  更新 ID
                </button>
                <button type="button" className="button button--danger" onClick={deleteSelectedId}>
                  删除 ID
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
