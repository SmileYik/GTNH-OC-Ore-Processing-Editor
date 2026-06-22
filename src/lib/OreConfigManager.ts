import { LuaSerializer } from './Luason';
import { OreConfig, OreRule, OreRules, RuleMeta, StringListMap, StringMap } from './OreConfig';

export interface RoleEntry {
  name: string;
  machine: string;
}

export interface InterfaceEntry {
  id: string;
  role: string;
}

export interface MineralProcess {
  mineral: string;
  steps: string[];
}

export interface FilterRuleEntry {
  rule: string;
  enable: boolean;
  comments: string;
}

export interface FilterGroup {
  role: string;
  rules: FilterRuleEntry[];
}

export interface ProcessReverseGroup {
  signature: string;
  steps: string[];
  minerals: string[];
}

export interface SerializeOreConfigOptions {
  compact?: boolean;
}

export const EMPTY_CONFIG = new OreConfig();

const LUA_SERIALIZER = new LuaSerializer();

function cloneRuleMeta(value: RuleMeta): RuleMeta {
  const next = new RuleMeta();
  next.enable = value.enable;
  next.comments = value.comments;
  return next;
}

function cloneRuleValue(value: boolean | RuleMeta): boolean | RuleMeta {
  return value instanceof RuleMeta ? cloneRuleMeta(value) : value;
}

function cloneOreRule(rule: OreRule): OreRule {
  const next = new OreRule();

  for (const [key, value] of Object.entries(rule)) {
    next[key] = cloneRuleValue(value as boolean | RuleMeta);
  }

  return next;
}

function cloneOreRules(rules: OreRules): OreRules {
  const next = new OreRules();

  for (const [key, value] of Object.entries(rules)) {
    next[key] = cloneOreRule(value as OreRule);
  }

  return next;
}

function cloneStringMap(input: StringMap): StringMap {
  const next = new StringMap();

  for (const [key, value] of Object.entries(input)) {
    next[key] = value;
  }

  return next;
}

function cloneStringListMap(input: StringListMap): StringListMap {
  const next = new StringListMap();

  for (const [key, value] of Object.entries(input)) {
    next[key] = [...value];
  }

  return next;
}

export function cloneOreConfig(config: OreConfig): OreConfig {
  const next = new OreConfig();
  next.interfaces = cloneStringMap(config.interfaces);
  next.role = cloneStringMap(config.role);
  next.process = cloneStringListMap(config.process);
  next.processReverse = cloneStringListMap(config.processReverse);
  next.idWhitelist = cloneOreRules(config.idWhitelist);
  next.idBlacklist = cloneOreRules(config.idBlacklist);
  next.logicalRules = cloneOreRules(config.logicalRules);
  return next;
}

function rebuildProcessReverse(config: OreConfig): void {
  const processReverse = new StringListMap();

  for (const [oreName, steps] of Object.entries(config.process)) {
    const signature = config.oreProcessToString(steps);
    const next = processReverse[signature] ?? [];
    next.push(oreName);
    processReverse[signature] = next;
  }

  config.processReverse = processReverse;
}

function normalizeOreConfig(config: OreConfig): OreConfig {
  const next = cloneOreConfig(config);
  next.renew();
  rebuildProcessReverse(next);
  return next;
}

function hasOwnEntries(value: object): boolean {
  return Object.keys(value).length > 0;
}

function mergeOreRuleGroups(target: OreRules, originalName: string, nextName: string): void {
  if (originalName === nextName) {
    return;
  }

  const source = target[originalName];
  if (!source) {
    return;
  }

  const existing = target[nextName];
  if (existing) {
    for (const [ruleName, ruleValue] of Object.entries(source)) {
      if (!(ruleName in existing)) {
        existing[ruleName] = cloneRuleValue(ruleValue as boolean | RuleMeta);
      }
    }
  } else {
    target[nextName] = cloneOreRule(source);
  }

  delete target[originalName];
}

function deleteRuleGroup(target: OreRules, name: string): void {
  delete target[name];
}

function renameRoleReferences(config: OreConfig, originalName: string, nextName: string): void {
  if (originalName === nextName) {
    return;
  }

  for (const [id, role] of Object.entries(config.interfaces)) {
    if (role === originalName) {
      config.interfaces[id] = nextName;
    }
  }

  for (const [mineral, steps] of Object.entries(config.process)) {
    config.process[mineral] = steps.map((step) => (step === originalName ? nextName : step));
  }

  mergeOreRuleGroups(config.idWhitelist, originalName, nextName);
  mergeOreRuleGroups(config.idBlacklist, originalName, nextName);
  mergeOreRuleGroups(config.logicalRules, originalName, nextName);
  rebuildProcessReverse(config);
}

function removeRoleReferences(config: OreConfig, name: string): void {
  for (const [id, role] of Object.entries(config.interfaces)) {
    if (role === name) {
      delete config.interfaces[id];
    }
  }

  for (const [mineral, steps] of Object.entries(config.process)) {
    config.process[mineral] = steps.filter((step) => step !== name);
  }

  deleteRuleGroup(config.idWhitelist, name);
  deleteRuleGroup(config.idBlacklist, name);
  deleteRuleGroup(config.logicalRules, name);
  rebuildProcessReverse(config);
}

function buildOreRuleGroup(rules: FilterRuleEntry[]): OreRule {
  const next = new OreRule();

  for (const rule of rules) {
    const meta = new RuleMeta();
    meta.enable = rule.enable;
    meta.comments = rule.comments;
    next[rule.rule] = meta;
  }

  return next;
}

export function parseOreConfig(text: string): OreConfig {
  return normalizeOreConfig(LUA_SERIALIZER.unserialization(text, OreConfig));
}

export function serializeOreConfig(config: OreConfig, options: SerializeOreConfigOptions = {}): string {
  const normalized = normalizeOreConfig(config);
  const serializable: Record<string, unknown> = {
    role: normalized.role,
    interfaces: normalized.interfaces,
    idBlacklist: normalized.idBlacklist,
    process: normalized.process,
    idWhitelist: normalized.idWhitelist,
    processReverse: normalized.processReverse
  };

  if (hasOwnEntries(normalized.logicalRules)) {
    serializable.logicalRules = normalized.logicalRules;
  }

  if (options.compact) {
    return LUA_SERIALIZER.serialization(serializable, 0, '', 0, '');
  }

  return LUA_SERIALIZER.serialization(serializable);
}

export function getRoleEntries(config: OreConfig): RoleEntry[] {
  return Object.entries(config.role).map(([name, machine]) => ({
    name,
    machine
  }));
}

export function getInterfaceEntries(config: OreConfig): InterfaceEntry[] {
  return Object.entries(config.interfaces).map(([id, role]) => ({
    id,
    role
  }));
}

export function getProcessEntries(config: OreConfig): MineralProcess[] {
  return Object.entries(config.process).map(([mineral, steps]) => ({
    mineral,
    steps: [...steps]
  }));
}

export function getFilterGroups(
  config: OreConfig,
  key: 'idWhitelist' | 'idBlacklist' | 'logicalRules'
): FilterGroup[] {
  return collectFilterGroups(config[key]);
}

export function buildProcessReverse(config: OreConfig): ProcessReverseGroup[] {
  const groups = new Map<string, ProcessReverseGroup>();

  for (const [mineral, steps] of Object.entries(config.process)) {
    const signature = config.oreProcessToString(steps);
    const existing = groups.get(signature);

    if (existing) {
      existing.minerals.push(mineral);
      continue;
    }

    groups.set(signature, {
      signature,
      steps: [...steps],
      minerals: [mineral]
    });
  }

  return Array.from(groups.values());
}

export function collectAvailableSteps(config: OreConfig): string[] {
  const steps: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    steps.push(value);
  };

  for (const role of Object.keys(config.role)) {
    push(role);
  }

  for (const process of Object.values(config.process)) {
    for (const step of process) {
      push(step);
    }
  }

  for (const group of Object.keys(config.idWhitelist)) {
    push(group);
  }

  for (const group of Object.keys(config.idBlacklist)) {
    push(group);
  }

  for (const group of Object.keys(config.logicalRules)) {
    push(group);
  }

  return steps;
}

export function formatProcessSignature(steps: string[]): string {
  return steps.length === 0 ? '空流程' : steps.join(' => ');
}

export function renameStepEverywhere(config: OreConfig, originalName: string, nextName: string): OreConfig {
  if (originalName === nextName) {
    return cloneOreConfig(config);
  }

  const next = cloneOreConfig(config);
  renameRoleReferences(next, originalName, nextName);
  const originalMachine = next.role[originalName];
  if (originalMachine !== undefined) {
    next.setRole(nextName, originalMachine);
    delete next.role[originalName];
  }
  return next;
}

export function removeStepEverywhere(config: OreConfig, name: string): OreConfig {
  const next = cloneOreConfig(config);
  delete next.role[name];
  removeRoleReferences(next, name);
  return next;
}

export function upsertRoleEntry(config: OreConfig, originalName: string | null, next: RoleEntry): OreConfig {
  const name = next.name.trim();
  const machine = next.machine.trim();

  if (!name) {
    throw new Error('职责名称不能为空');
  }

  if (!machine) {
    throw new Error('机器名称不能为空');
  }

  const nextConfig = cloneOreConfig(config);

  if (originalName && originalName !== name) {
    renameRoleReferences(nextConfig, originalName, name);
    delete nextConfig.role[originalName];
  }

  if (!originalName && nextConfig.role[name] !== undefined) {
    throw new Error(`职责 "${name}" 已存在`);
  }

  nextConfig.setRole(name, machine);
  return nextConfig;
}

export function deleteRoleEntry(config: OreConfig, name: string): OreConfig {
  return removeStepEverywhere(config, name);
}

export function upsertInterfaceEntry(
  config: OreConfig,
  originalId: string | null,
  next: InterfaceEntry
): OreConfig {
  const id = next.id.trim();
  const role = next.role.trim();

  if (!id) {
    throw new Error('输出口 ID 不能为空');
  }

  if (!role) {
    throw new Error('职责不能为空');
  }

  const nextConfig = cloneOreConfig(config);

  if (!collectAvailableSteps(nextConfig).includes(role)) {
    throw new Error(`职责 "${role}" 不存在`);
  }

  if (!originalId && nextConfig.interfaces[id] !== undefined) {
    throw new Error(`输出口 "${id}" 已存在`);
  }

  if (originalId && originalId !== id && nextConfig.interfaces[id] !== undefined) {
    throw new Error(`输出口 "${id}" 已存在`);
  }

  if (originalId && originalId !== id) {
    delete nextConfig.interfaces[originalId];
  }

  nextConfig.setInterface(id, role);
  return nextConfig;
}

export function deleteInterfaceEntry(config: OreConfig, id: string): OreConfig {
  const next = cloneOreConfig(config);
  delete next.interfaces[id];
  return next;
}

export function upsertProcessEntry(
  config: OreConfig,
  originalMineral: string | null,
  next: MineralProcess,
  options: { forceReplace?: boolean } = {}
): OreConfig {
  const mineral = next.mineral.trim();
  const steps = next.steps.map((step) => step.trim()).filter(Boolean);
  const forceReplace = Boolean(options.forceReplace);

  if (!mineral) {
    throw new Error('矿物名称不能为空');
  }

  if (steps.length === 0) {
    throw new Error('至少需要一个处理步骤');
  }

  const nextConfig = cloneOreConfig(config);
  const existing = nextConfig.process[mineral];
  const isReplacingDifferentKey = originalMineral !== null && originalMineral !== mineral;
  const duplicateExists = existing !== undefined && originalMineral !== mineral;

  if (duplicateExists && !forceReplace) {
    throw new Error(`矿物 "${mineral}" 已存在`);
  }

  if (isReplacingDifferentKey) {
    nextConfig.setOreProcess(originalMineral, undefined);
  }

  nextConfig.setOreProcess(mineral, steps);
  return nextConfig;
}

export function deleteProcessEntry(config: OreConfig, mineral: string): OreConfig {
  const next = cloneOreConfig(config);
  next.setOreProcess(mineral, undefined);
  return next;
}

function cloneFilterRuleEntry(entry: FilterRuleEntry): FilterRuleEntry {
  return {
    rule: entry.rule,
    enable: entry.enable,
    comments: entry.comments
  };
}

export function formatFilterRuleLabel(rule: FilterRuleEntry): string {
  const comments = rule.comments.trim();
  return comments || rule.rule;
}

export function cloneFilterGroups(groups: FilterGroup[]): FilterGroup[] {
  return groups.map((group) => ({
    role: group.role,
    rules: group.rules.map((rule) => cloneFilterRuleEntry(rule))
  }));
}

export function collectFilterGroups(rules: OreRules): FilterGroup[] {
  return Object.entries(rules).map(([role, rule]) => ({
    role,
    rules: Object.entries(rule).map(([ruleText, value]) => {
      if (value instanceof RuleMeta) {
        return {
          rule: ruleText,
          enable: value.enable,
          comments: value.comments
        };
      }

      if (typeof value === 'boolean') {
        return {
          rule: ruleText,
          enable: value,
          comments: ''
        };
      }

      return {
        rule: ruleText,
        enable: true,
        comments: ''
      };
    })
  }));
}

export function setFilterGroups(
  config: OreConfig,
  key: 'idWhitelist' | 'idBlacklist' | 'logicalRules',
  groups: FilterGroup[]
): OreConfig {
  const next = cloneOreConfig(config);
  const updated = new OreRules();

  for (const group of groups) {
    updated[group.role] = buildOreRuleGroup(group.rules);
  }

  next[key] = updated;
  next.renew();
  return next;
}
