export class StringMap {
  [key: string]: string;

  *[Symbol.iterator](): Iterator<[string, string]> {
    for (const [key, value] of Object.entries(this)) {
      yield [key, value];
    }
  }
}

export class StringListMap {
  [key: string]: string[];
  static __indexType__ = Array;

  *[Symbol.iterator](): Iterator<[string, string[]]> {
    for (const [key, value] of Object.entries(this)) {
      yield [key, value];
    }
  }
}

export class RuleMeta {
  /**
   * 是否启用规则
   */
  enable: boolean = false;
  /**
   * 规则描述
   */
  comments: string = "";
}

export class OreRule {
  [rule: string]: boolean | RuleMeta | any;

  static __indexType__ = RuleMeta;

  static __validateIndex__(key: string, value: any) {
    if (typeof value !== 'boolean' && !(value instanceof RuleMeta)) {
      throw new Error(`Ilegal value for key '${key}':  ${value}`)
    }
  }

  *[Symbol.iterator](): Iterator<[string, boolean | RuleMeta]> {
    for (const [key, value] of Object.entries(this)) {
      yield [key, value];
    }
  }

  public convertValueToRuleMeta() {
    for (let [rule, value] of this) {
      if (typeof value === 'boolean') {
        this[rule] = {enable: value, comments: ""}
      }
    }
  }
}

export class OreRules {
  [role: string]: OreRule | any;
  static __indexType__ = OreRule;

  *[Symbol.iterator](): Iterator<[string, OreRule]> {
    for (const [key, value] of Object.entries(this)) {
      yield [key, value];
    }
  }

  public convertValueToRuleMeta() {
    for (let [_, value] of this) {
      value.convertValueToRuleMeta()
    }
  }
}

export class OreConfig {
  /**
   * 输出口表
   * MEInterfaceAddress: Role
   */
  interfaces: StringMap = new StringMap;

  /**
   * 职责表
   * RoleAlias: Role/Machine
   */
  role: StringMap = new StringMap;

  /**
   * 矿物处理流程表
   * Ore Name: Ore Process
   */
  process: StringListMap = new StringListMap;

  /**
   * 矿物流程反查矿物表
   * Ore Process String: Ore Name List
   */
  processReverse: StringListMap = new StringListMap;

  /**
   * 物品ID白名单规则表
   */
  idWhitelist: OreRules = new OreRules;
  /**
   * 物品ID黑名单规则表
   */
  idBlacklist: OreRules = new OreRules;
  /**
   * 逻辑运算表达式规则表
   */
  logicalRules: OreRules = new OreRules;

  /**
   * 将配置转换为最新的存储形式
   */
  public renew() {
    this.idWhitelist.convertValueToRuleMeta()
    this.idBlacklist.convertValueToRuleMeta()
    this.logicalRules.convertValueToRuleMeta()
  }

  private setOrDeleteStringMap(records: Record<string, any>, key: string, value?: any) {
    if (value) {
      records[key] = value
    } else {
      delete records[key]
    }
  }

  /**
   * 设置输出接口的职责, 如果不填入职责则代表删除
   * @param meInterfaceAddress 输出口地址ID
   * @param role 职责, 若填入则删除.
   */
  public setInterface(meInterfaceAddress: string, role?: string) {
    this.setOrDeleteStringMap(this.interfaces, meInterfaceAddress, role)
  }

  /**
   * 设置职责
   * @param roleAlias 职责名称
   * @param role 机器类型, 若不填入则代表删除
   */
  public setRole(roleAlias: string, role?: string) {
    this.setOrDeleteStringMap(this.role, roleAlias, role)
  }

  /**
   * 将流程列表转为流程字符串
   * @param process 流程列表
   * @param connectChar 连接字符, 若不填则为 =>
   * @returns 流程列表字符串
   */
  public oreProcessToString(process: string[], connectChar: string = "=>"): string {
    return process.join(connectChar)
  }

  /**
   * 删除矿物流程表中的矿物
   * @param oreName 矿物名称
   */
  private deleteOreInProcessReverse(oreName: string) {
    const changed = {} as StringListMap
    Object.entries(this.processReverse).forEach(([key, ores]) => {
      const list = ores.filter(it => it !== oreName)
      if (list.length !== ores.length) {
        changed[key] = list
      }
    })
    Object.entries(changed).forEach(([key, ores]) => {
      this.setOrDeleteStringMap(this.processReverse, key, oreName.length === 0 ? undefined : ores)
    })
  }

  /**
   * 设置矿物流程.
   * @param oreName 矿物名称 
   * @param process 矿物流程, 若不填则代表删除该矿物
   */
  public setOreProcess(oreName: string, process?: string[]) {
    this.setOrDeleteStringMap(this.process, oreName, process)
    this.deleteOreInProcessReverse(oreName)
    if (process) {
      const key = this.oreProcessToString(process)
      this.processReverse[key] = [...this.processReverse[key] || [], oreName]
    }
  }

  private getOreRuleByRole(oreRules: OreRules, role: string): OreRule {
    oreRules[role] = oreRules[role] || new OreRule
    return oreRules[role]
  }

  /**
   * 获取ID白名单的矿物规则
   * @param role 职责
   * @returns 矿物规则
   */
  public getIdWhitelistRule(role: string): OreRule {
    return this.getOreRuleByRole(this.idWhitelist, role)
  }

  /**
   * 获取ID黑名单的矿物规则
   * @param role 职责
   * @returns 矿物规则
   */
  public getIdBlacklistRule(role: string): OreRule {
    return this.getOreRuleByRole(this.idBlacklist, role)
  }

  /**
   * 获取逻辑规则的矿物规则
   * @param role 职责
   * @returns 矿物规则
   */
  public getLogicalRule(role: string): OreRule {
    return this.getOreRuleByRole(this.logicalRules, role)
  }
}
