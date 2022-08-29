import { Attribute, CharacterType, MonsterName, SkillName } from "./adventureland-data.js"
import { PathfinderOptions } from "./pathfinder.js"

/** Filters for returning a list of entities */
export type GetEntitiesFilters = {
    canDamage?: boolean | SkillName
    canKillInOneShot?: SkillName
    canWalkTo?: boolean
    couldGiveCredit?: boolean
    hpGreaterThan?: number
    hpLessThan?: number
    ignoreIDs?: Iterable<string>
    isDisabled?: boolean
    withinRange?: number | SkillName
    targetingMe?: boolean
    targetingPartyMember?: boolean
    targetingPlayer?: string
    /** Returns entities with types not equal to this type */
    notType?: MonsterName
    /** Returns entities with types not equal to any in the provided list */
    notTypeList?: MonsterName[]
    type?: MonsterName
    typeList?: MonsterName[]
    level?: number
    levelGreaterThan?: number
    levelLessThan?: number
    willBurnToDeath?: boolean
    willDieToProjectiles?: boolean
}

/** Filters for returning a single entity */
export type GetEntityFilters = GetEntitiesFilters & {
    returnHighestHP?: boolean
    returnLowestHP?: boolean
    returnFurthest?: boolean
    returnNearest?: boolean
}

/** Filters for returning a list of players */
export type GetPlayersFilters = {
    canDamage?: boolean | SkillName
    canWalkTo?: boolean
    ctype?: CharacterType
    hpGreaterThan?: number
    hpLessThan?: number
    ignoreIDs?: Iterable<string>
    isDead?: boolean
    isDisabled?: boolean
    isFriendly?: boolean
    isNPC?: boolean
    isPartyMember?: boolean
    withinRange?: number | SkillName
    targetingMe?: boolean
    targetingPartyMember?: boolean
    targetingPlayer?: string
    level?: number
    levelGreaterThan?: number
    levelLessThan?: number
}

/** Filters for returning a single player */
export type GetPlayerFilters = GetPlayersFilters & {
    returnHighestHP?: boolean
    returnLowestHP?: boolean
    returnNearest?: boolean
}

/** Filters for returning a list of items */
export type LocateItemsFilters = {
    level?: number;
    levelGreaterThan?: number;
    levelLessThan?: number;
    locked?: boolean;
    /** Is the item PvP marked? (i.e. does it have a chance to drop if we die to another player?) */
    pvpMarked?: boolean;
    quantityGreaterThan?: number;
    /** Is the item special? (e.g.: shiny, firehazard, lucky, glitched, ...) */
    special?: boolean;
    /** The scroll applied to the weapon (e.g.: int, dex, str, ...) */
    statType?: Attribute;
}

/** Filters for returning a single item */
export type LocateItemFilters = LocateItemsFilters & {
    returnHighestLevel?: boolean;
    returnHighestQuantity?: boolean;
    returnLowestLevel?: boolean;
    returnLowestQuantity?: boolean;
}

export type SmartMoveOptions = PathfinderOptions & {
    /** If set, this function will be called before every action. Useful if you want to stop smartMoving early. */
    stopIfTrue?: () => boolean
    /** If set, we will resolve the promise when we start moving our final move instead of completing the final move */
    resolveOnFinalMoveStart?: boolean
    /** If set, we will console.log() messages */
    showConsole?: boolean
}