import { Document, Model } from "mongoose"
import { ServerRegion, ServerIdentifier, StatusInfo, SlotInfo } from "../../definitions/adventureland.js"
import { CharacterType, MapName } from "../../definitions/adventureland-data.js"
import { ItemData } from "../../index.js"

export interface IPlayer {
    aldata?: string
    discord?: string
    in: string
    items?: ItemData[]
    lastSeen?: number
    map: MapName
    name: string
    owner: string
    party?: string
    rip?: boolean
    serverIdentifier: ServerIdentifier
    serverRegion: ServerRegion
    slots: SlotInfo
    s?: StatusInfo
    type: CharacterType
    x: number
    y: number
}

export interface IPlayerDocument extends IPlayer, Document { }

export type IPlayerModel = Model<IPlayerDocument>