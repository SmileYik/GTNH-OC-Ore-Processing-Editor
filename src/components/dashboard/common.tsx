import { Fragment, useMemo, type ReactNode } from 'react';
import { FilterRuleEntry, formatFilterRuleLabel, type FilterGroup } from '../../lib/OreConfigManager';
import { type LanguageConfig, useConfig } from '../../config';
import { peekAndFindResourceRecord, type ResourceLocale, useResourceDatabaseCacheRevision } from '../../lib/resourceDatabase';

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

export function findMineralName(mineral: string, langConfig: LanguageConfig): string {
  const formaters = [
    "%s Ore",
    "Raw %s Ore",
    "%s Infused Stone",
    "%s Sand#gregtech:gt.blockores",
    "Raw %s Sand Ore",
    "%s"
  ]
  for (const formater of formaters) {
    const record = peekAndFindResourceRecord('item', false, formater.replace("%s", mineral), langConfig);
    if (record) return record.localizedName;
  }
  return mineral;
}

export function useNameFilledMinerals(minerals: string[], lang: LanguageConfig): string[] {
  return minerals.map((it) => findMineralName(it, lang));
}

export function MineralTags({ minerals, lang }: { minerals: string[], lang: LanguageConfig }) {
  const displayRevision = useResourceDatabaseCacheRevision('item', lang.display as ResourceLocale);
  const gameRevision = useResourceDatabaseCacheRevision('item', lang.game as ResourceLocale);
  const visualMinerals = useMemo(() => {
    if (minerals.length === 0) {
      return [];
    }

    return useNameFilledMinerals(minerals, lang);
  }, [minerals, lang.display, lang.game, displayRevision, gameRevision]);

  if (visualMinerals.length === 0) {
    return <span className="empty-chip">暂无矿物</span>;
  }

  return (
    <div className="tag-list">
      {visualMinerals.map((mineral, index) => (
        <span className="chip chip--soft" key={`${mineral}-${index}`}>
          {mineral}
        </span>
      ))}
    </div>
  );
}

export function useNameFilledFilterGroups(groups: FilterGroup[], lang: LanguageConfig): FilterGroup[] {
  let gs: FilterGroup[] = [];
  for (const group of groups) {
    gs.push({
      role: group.role,
      rules: group.rules.map((it) => {
        const result: FilterRuleEntry = {...it};
        if (!result.comments) {
          const record = peekAndFindResourceRecord('item', true, it.rule, lang);
          if (record) {
            result.rule = record.localizedName;
          }
        }
        
        return result;
      })
    })
  }
  return gs;
}

export function TreeRoot({ title, groups }: { title: string; groups: FilterGroup[] }) {
  const userConfig = useConfig();
  const displayRevision = useResourceDatabaseCacheRevision('item', userConfig.lang.display as ResourceLocale);

  const visualGroups = useMemo(() => {
    return useNameFilledFilterGroups(groups, userConfig.lang);
  }, [groups, userConfig.lang.display, userConfig.lang.game, displayRevision]);

  return (
    <div className="tree-root scroll-stack">
      <div className="tree-root__title">{title}</div>
      {groups.length === 0 ? (
        <div className="empty-state empty-state--compact">暂无数据</div>
      ) : (
        visualGroups.map((group) => (
          <div className="tree-group tree-group--readonly" key={`${group.role}-${title}`}>
            <div className="tree-group__header tree-group__header--readonly">
              <span>{group.role}</span>
              <span className="tree-group__count">{group.rules.length}</span>
            </div>
            <div className="tree-group__items">
              {group.rules.length === 0 ? (
                <span className="tree-group__empty">空</span>
              ) : (
                group.rules.map((rule, index) => (
                  <span
                    className={`tree-item tree-item--readonly${rule.enable ? '' : ' tree-item--disabled'}`}
                    key={`${group.role}-${rule.rule}-${index}`}
                    title={`规则: ${rule.rule}${rule.comments.trim() ? `\n注释: ${rule.comments.trim()}` : ''}\n状态: ${rule.enable ? '启用' : '停用'}`}
                  >
                    <span className="tree-item__label">{formatFilterRuleLabel(rule)}</span>
                    <span
                      className={`tree-item__status${rule.enable ? ' tree-item__status--on' : ' tree-item__status--off'}`}
                      aria-label={rule.enable ? '已启用' : '已停用'}
                    >
                      {rule.enable ? '启用' : '停用'}
                    </span>
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
