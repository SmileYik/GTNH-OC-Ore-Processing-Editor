import { LuaSerializer } from "./Luason"
import { OreConfig } from "./OreConfig"

export const EMPTY_CONFIG = new OreConfig
export const LUA_SERIALIZER = new LuaSerializer()
export const parseOreConfig = (text: string) => {
  const config = LUA_SERIALIZER.unserialization(text, OreConfig)
  config.renew()
  return config
}