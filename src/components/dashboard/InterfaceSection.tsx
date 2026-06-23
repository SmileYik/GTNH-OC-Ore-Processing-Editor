import type { InterfaceEntry } from '../../lib/OreConfigManager';
import { Section } from './common';

interface InterfaceSectionProps {
  interfaces: InterfaceEntry[];
  availableRoles: string[];
  onAddInterface: () => void;
  onEditInterface: (entry: InterfaceEntry) => void;
  onDeleteInterface: (id: string) => void;
}

export function InterfaceSection({
  interfaces,
  availableRoles,
  onAddInterface,
  onEditInterface,
  onDeleteInterface
}: InterfaceSectionProps) {
  return (
    <Section
      title="ME 接口列表"
      subtitle="是指游戏中适配器贴着的ME接口, 这里管理每个 ME 接口地址以及它对应的职责。"
      className="panel--tall"
      actions={
        <button type="button" className="button button--tonal button--compact" onClick={onAddInterface}>
          新增ME接口
        </button>
      }
    >
      <div className="scroll-stack">
        {interfaces.length === 0 ? (
          <div className="empty-state empty-state--compact">暂无输出口。</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ME接口地址</th>
                  <th>职责</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {interfaces.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{entry.id}</td>
                    <td>{entry.role}</td>
                    <td>
                      <div className="button-row">
                        <button
                          type="button"
                          className="button button--tonal button--compact"
                          onClick={() => onEditInterface(entry)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="button button--danger button--compact"
                          onClick={() => onDeleteInterface(entry.id)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <section className="subpanel">
          <div className="subpanel__header">
            <h3>ME接口可选职责</h3>
            <span>来自当前配置中的职责列表</span>
          </div>
          {availableRoles.length === 0 ? (
            <div className="empty-state empty-state--compact">暂无可用职责。</div>
          ) : (
            <div className="tag-list">
              {availableRoles.map((role) => (
                <span className="chip chip--soft" key={role}>
                  {role}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </Section>
  );
}
