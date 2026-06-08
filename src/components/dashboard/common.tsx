import { Fragment, type ReactNode } from 'react';
import type { FilterGroup } from '../../lib/luaConfig';

export function Section({
  title,
  subtitle,
  actions,
  children,
  className = ''
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel__header">
        <div className="panel__heading">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function StepPath({ steps }: { steps: string[] }) {
  if (steps.length === 0) {
    return <span className="empty-chip">空流程</span>;
  }

  return (
    <div className="path-chips">
      {steps.map((step, index) => (
        <Fragment key={`${step}-${index}`}>
          <span className="chip chip--path">{step}</span>
          {index < steps.length - 1 ? <span className="path-arrow">→</span> : null}
        </Fragment>
      ))}
    </div>
  );
}

export function MineralTags({ minerals }: { minerals: string[] }) {
  if (minerals.length === 0) {
    return <span className="empty-chip">暂无矿物</span>;
  }

  return (
    <div className="tag-list">
      {minerals.map((mineral, index) => (
        <span className="chip chip--soft" key={`${mineral}-${index}`}>
          {mineral}
        </span>
      ))}
    </div>
  );
}

export function TreeRoot({ title, groups }: { title: string; groups: FilterGroup[] }) {
  return (
    <div className="tree-root">
      <div className="tree-root__title">{title}</div>
      {groups.length === 0 ? (
        <div className="empty-state empty-state--compact">暂无数据</div>
      ) : (
        groups.map((group) => (
          <div className="tree-group tree-group--readonly" key={`${group.role}-${title}`}>
            <div className="tree-group__header tree-group__header--readonly">
              <span>{group.role}</span>
              <span className="tree-group__count">{group.ids.length}</span>
            </div>
            <div className="tree-group__items">
              {group.ids.length === 0 ? (
                <span className="tree-group__empty">空</span>
              ) : (
                group.ids.map((id, index) => (
                  <span className="tree-item tree-item--readonly" key={`${group.role}-${id}-${index}`}>
                    {id}
                  </span>
                ))
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
