import { Config } from '../../config';
import type { FilterGroup } from '../../lib/OreConfigManager';
import { Section, TreeRoot } from './common';

interface FilterListCardProps {
  title: string;
  kindLabel: string;
  groups: FilterGroup[];
  userConfig: Config;
  onEdit: () => void;
}

export function FilterListCard({ title, kindLabel, groups, onEdit, userConfig }: FilterListCardProps) {
  return (
    <Section
      title={title}
      subtitle={kindLabel}
      className="panel--tall"
      actions={
        <button type="button" className="button button--filled button--compact" onClick={onEdit}>
          编辑
        </button>
      }
    >
      <TreeRoot title={title} groups={groups} userConfig={userConfig} />
    </Section>
  );
}
