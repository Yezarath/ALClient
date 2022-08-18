import { CharacterData, DisappearingTextData, EvalData, GameResponseData, UIData } from "./definitions/adventureland-server.js"
import { TradeSlotType } from "./definitions/adventureland.js"
import { Constants } from "./Constants.js"
import { PingCompensatedCharacter } from "./PingCompensatedCharacter.js"
import { Tools } from "./Tools.js"
import { ItemName } from "./definitions/adventureland-data.js"

export class Merchant extends PingCompensatedCharacter {
    ctype: "merchant" = "merchant"

    /**
     * Fish for items
     *
     * @return {*}  {Promise<void>}
     * @memberof Merchant
     */
    public async fish(): Promise<void> {
        if (!this.ready) throw new Error("We aren't ready yet [fish].")
        let startedFishing = false
        if (this.c.fishing) startedFishing = true // We're already fishing!?
        const fished = new Promise<void>((resolve, reject) => {
            const caughtCheck = (data: EvalData) => {
                if (/skill_timeout\s*\(\s*['"]fishing['"]\s*,?\s*(\d+\.?\d+?)?\s*\)/.test(data.code)) {
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("ui", failCheck2)
                    this.socket.off("eval", caughtCheck)
                    this.socket.off("player", failCheck3)
                    resolve()
                }
            }

            const failCheck1 = (data: GameResponseData) => {
                if (typeof data == "string") {
                    if (data == "skill_cant_wtype") {
                        this.socket.off("game_response", failCheck1)
                        this.socket.off("ui", failCheck2)
                        this.socket.off("eval", caughtCheck)
                        this.socket.off("player", failCheck3)
                        reject("We don't have a fishing rod equipped")
                    }
                } else if (typeof data == "object") {
                    if (data.response == "cooldown" && data.place == "fishing" && data.skill == "fishing") {
                        this.socket.off("game_response", failCheck1)
                        this.socket.off("ui", failCheck2)
                        this.socket.off("eval", caughtCheck)
                        this.socket.off("player", failCheck3)
                        reject(`Fishing is on cooldown (${data.ms}ms remaining)`)
                    }
                }
            }

            const failCheck2 = (data: UIData) => {
                if (data.type == "fishing_fail" && data.name == this.id) {
                    // NOTE: We might not be in a fishing area?
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("ui", failCheck2)
                    this.socket.off("eval", caughtCheck)
                    this.socket.off("player", failCheck3)
                    reject("We failed to fish.")
                } else if (data.type == "fishing_none") {
                    // We fished, but we didn't catch anything
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("ui", failCheck2)
                    this.socket.off("eval", caughtCheck)
                    this.socket.off("player", failCheck3)
                    resolve()
                }
            }

            const failCheck3 = (data: CharacterData) => {
                if (!startedFishing && data.c.fishing) {
                    startedFishing = true
                } else if (startedFishing && !data.c.fishing) {
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("ui", failCheck2)
                    this.socket.off("eval", caughtCheck)
                    this.socket.off("player", failCheck3)
                    // TODO: Is there a reliable way to figure out if we got interrupted?
                    // TODO: Maybe the eval cooldown?
                    resolve() // We fished and caught nothing, or got interrupted.
                }
            }

            setTimeout(() => {
                this.socket.off("game_response", failCheck1)
                this.socket.off("ui", failCheck2)
                this.socket.off("eval", caughtCheck)
                this.socket.off("player", failCheck3)
                reject("fish timeout (20000ms)")
            }, 20000)
            this.socket.on("game_response", failCheck1)
            this.socket.on("eval", caughtCheck)
            this.socket.on("ui", failCheck2)
            this.socket.on("player", failCheck3)
        })

        this.socket.emit("skill", { name: "fishing" })
        return fished
    }

    // TODO: Add promises
    public async joinGiveaway(slot: TradeSlotType, id: string, rid: string): Promise<void> {
        if (!this.ready) throw new Error("We aren't ready yet [joinGiveaway].")
        const merchant = this.players.get(id)
        if (!merchant || Tools.squaredDistance(this, merchant) > Constants.NPC_INTERACTION_DISTANCE_SQUARED) throw new Error(`${id} is too far away.`)
        if (!merchant.slots[slot]?.giveaway) throw new Error(`${id}'s slot ${slot} is not a giveaway.`)
        if (merchant.slots[slot]?.list.includes(this.id)) return // We've already joined it

        // const joined = new Promise<void>((resolve, reject) => {
        //     // TODO
        // })

        this.socket.emit("join_giveaway", { slot: slot, id: id, rid: rid })
        // return joined
    }

    /**
     * Lists an item for sale on your merchant stand
     *
     * @param {number} itemPos the position of the item in your inventory
     * @param {number} price the price to sell the item
     * @param {TradeSlotType} [tradeSlot] the trade slot to list the item in
     * @param {number} [quantity=1] the number of items to sell at this price
     * @return {*}  {Promise<unknown>}
     * @memberof Merchant
     */
    public async listForSale(itemPos: number, price: number, tradeSlot?: TradeSlotType, quantity = 1): Promise<unknown> {
        if (!this.ready) throw new Error("We aren't ready yet [listForSale].")
        const itemInfo = this.items[itemPos]
        if (!itemInfo) throw new Error(`We do not have an item in slot ${itemPos}`)
        if (price <= 0) throw new Error("The lowest you can set the price is 1.")
        if (quantity <= 0) throw new Error("The lowest you can set the quantity to is 1.")
        const gInfo = this.G.items[itemInfo.name]
        if (!tradeSlot && itemInfo.q) {
            // Look for an existing item to stack for sale
            for (const slotName in this.slots) {
                if (!slotName.startsWith("trade")) continue // Not a trade slot
                const slotInfo = this.slots[slotName as TradeSlotType]
                if (!slotInfo) continue // Nothing in this slot

                if (slotInfo.name !== itemInfo.name) continue // Check if it's the same item
                if (slotInfo.p !== itemInfo.p) continue

                if (quantity + slotInfo.q > gInfo.s) continue // Check if it's stackable

                if (price < slotInfo.price) continue // We're listing it for less, don't list them all at this price.

                tradeSlot = slotName as TradeSlotType
                break
            }
        }
        if (!tradeSlot) {
            // Look for an empty trade slot to list this item in
            for (const slotName in this.slots) {
                if (!slotName.startsWith("trade")) continue // Not a trade slot
                const slotInfo = this.slots[slotName as TradeSlotType]
                if (slotInfo) continue

                tradeSlot = slotName as TradeSlotType
                break
            }
            if (!tradeSlot) throw new Error("We don't have an empty trade slot to list the item for sale.")
        }
        const slotInfo = this.slots[tradeSlot]
        if (slotInfo) {
            if (itemInfo.name == slotInfo.name // Same item
                && price >= slotInfo.price // Same, or higher price
                && gInfo.s && (quantity + slotInfo.q) <= gInfo.s) // Stackable
            {
                if (itemPos !== 0) {
                    // Swap items so when it gets stacked, it gets stacked in the correct position
                    await this.swapItems(0, itemPos)
                }

                // Unequip, so we can combine the two slots
                await this.unequip(tradeSlot)
                quantity += slotInfo.q

                if (itemPos !== 0) {
                    // Swap back
                    await this.swapItems(0, itemPos)
                }
            } else {
                throw new Error(`We are already trading something in ${tradeSlot}.`)
            }
        }

        const listed = new Promise<void>((resolve, reject) => {
            const failCheck1 = (data: GameResponseData) => {
                if (typeof data == "string") {
                    if (data == "slot_occupied") {
                        this.socket.off("game_response", failCheck1)
                        this.socket.off("disappearing_text", failCheck2)
                        this.socket.off("player", successCheck)
                        reject(`We are already listing something in ${tradeSlot}.`)
                    }
                }
            }

            const failCheck2 = (data: DisappearingTextData) => {
                if (data.message == "CAN'T EQUIP" && data.id == this.id) {
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("disappearing_text", failCheck2)
                    this.socket.off("player", successCheck)
                    reject(`We failed listing the item in ${tradeSlot}.`)
                }
            }

            const successCheck = (data: CharacterData) => {
                const newTradeSlot = data.slots[tradeSlot]
                if (newTradeSlot && newTradeSlot.name == itemInfo.name && newTradeSlot.q == quantity) {
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("disappearing_text", failCheck2)
                    this.socket.off("player", successCheck)
                    resolve()
                }
            }

            setTimeout(() => {
                this.socket.off("game_response", failCheck1)
                this.socket.off("disappearing_text", failCheck2)
                this.socket.off("player", successCheck)
                reject("listForSale timeout (1000ms)")
            }, 1000)
            this.socket.on("game_response", failCheck1)
            this.socket.on("disappearing_text", failCheck2)
            this.socket.on("player", successCheck)
        })

        this.socket.emit("equip", {
            num: itemPos,
            price: price,
            q: quantity,
            slot: tradeSlot
        })
        return listed
    }

    /**
     * NOTE: Untested
     *
     * Adds an item that you want to purchase to your trade listing
     *
     * To remove a listing, call unequip(tradeSlot)
     *
     * @param itemName The item you want to buy
     * @param price The price you'll pay for it
     * @param tradeSlot The trade slot you want to put the request in
     * @param quantity How many of the item you want to buy
     * @param level For equipment, the level of the item you wish to buy
     */
    public async listForPurchase(itemName: ItemName, price: number, tradeSlot?: TradeSlotType, quantity = 1, level?: number): Promise<unknown> {
        if (!this.ready) throw new Error("We aren't ready yet [listForPurchase].")

        if (price <= 0) throw new Error("The lowest you can set the price is 1.")
        if (quantity <= 0) throw new Error("The lowest you can set the quantity to is 1.")
        if (!tradeSlot) {
            for (const slotName in this.slots) {
                if (!slotName.startsWith("trade")) continue // Not a trade slot
                const slotInfo = this.slots[slotName as TradeSlotType]
                if (slotInfo) continue

                tradeSlot = slotName as TradeSlotType
                break
            }
            if (!tradeSlot) throw new Error("We don't have any empty trade slot to wishlist the item.")
        } else {
            if (this.slots[tradeSlot]) throw new Error(`We already have something listed in '${tradeSlot}'.`)
            if (this.slots[tradeSlot] === undefined) throw new Error(`We don't have a trade slot '${tradeSlot}'.`)
        }
        const wishListed = new Promise<void>((resolve, reject) => {
            const successCheck = (data: CharacterData) => {
                const newTradeSlot = data.slots[tradeSlot]
                if (!newTradeSlot) return // No data (yet?)
                if (!newTradeSlot.b) return
                if (newTradeSlot.name !== itemName) return
                if (newTradeSlot.q !== quantity) return
                if (newTradeSlot.price !== price) return

                this.socket.off("player", successCheck)
                this.socket.off("game_response", failCheck)
                resolve()
            }
            const failCheck = (data: GameResponseData) => {
                if (typeof data == "string") {
                    if (data == "slot_occupied") {
                        this.socket.off("player", successCheck)
                        this.socket.off("game_response", failCheck)
                        reject(`We already have something listed in '${tradeSlot}'.`)
                    }
                }
            }
            setTimeout(() => {
                this.socket.off("player", successCheck)
                this.socket.off("game_response", failCheck)
                reject("listForPurchase timeout (1000ms)")
            }, 1000)
            this.socket.on("player", successCheck)
            this.socket.on("game_response", failCheck)
        })
        this.socket.emit("trade_wishlist", {
            level: level,
            name: itemName,
            price: price,
            q: quantity,
            slot: tradeSlot
        })
        return wishListed
    }

    // TODO: Add promises
    public async merchantCourage(): Promise<void> {
        if (!this.ready) throw new Error("We aren't ready yet [merchantCourage].")
        this.socket.emit("skill", { name: "mcourage" })
    }

    public async mine(): Promise<void> {
        if (!this.ready) throw new Error("We aren't ready yet [mine].")
        let startedMining = false
        if (this.c.mining) startedMining = true // We're already mining!?
        const mined = new Promise<void>((resolve, reject) => {
            const caughtCheck = (data: EvalData) => {
                if (/skill_timeout\s*\(\s*['"]mining['"]\s*,?\s*(\d+\.?\d+?)?\s*\)/.test(data.code)) {
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("ui", failCheck2)
                    this.socket.off("eval", caughtCheck)
                    this.socket.off("player", failCheck3)
                    resolve()
                }
            }

            const failCheck1 = (data: GameResponseData) => {
                if (typeof data == "string") {
                    if (data == "skill_cant_wtype") {
                        this.socket.off("game_response", failCheck1)
                        this.socket.off("ui", failCheck2)
                        this.socket.off("eval", caughtCheck)
                        this.socket.off("player", failCheck3)
                        reject("We don't have a pickaxe equipped")
                    }
                } else if (typeof data == "object") {
                    if (data.response == "cooldown" && data.place == "mining" && data.skill == "mining") {
                        this.socket.off("game_response", failCheck1)
                        this.socket.off("ui", failCheck2)
                        this.socket.off("eval", caughtCheck)
                        this.socket.off("player", failCheck3)
                        reject(`Mining is on cooldown (${data.ms}ms remaining)`)
                    }
                }
            }

            const failCheck2 = (data: UIData) => {
                if (data.type == "mining_fail" && data.name == this.id) {
                    // NOTE: We might not be in a mining area?
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("ui", failCheck2)
                    this.socket.off("eval", caughtCheck)
                    this.socket.off("player", failCheck3)
                    reject("We failed to mine.")
                } else if (data.type == "mining_none") {
                    // We mined, but we didn't get anything
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("ui", failCheck2)
                    this.socket.off("eval", caughtCheck)
                    this.socket.off("player", failCheck3)
                    resolve()
                }
            }

            const failCheck3 = (data: CharacterData) => {
                if (!startedMining && data.c.mining) {
                    startedMining = true
                } else if (startedMining && !data.c.mining) {
                    this.socket.off("game_response", failCheck1)
                    this.socket.off("ui", failCheck2)
                    this.socket.off("eval", caughtCheck)
                    this.socket.off("player", failCheck3)
                    // TODO: Is there a reliable way to figure out if we got interrupted?
                    // TODO: Maybe the eval cooldown?
                    resolve() // We mined and caught nothing, or got interrupted.
                }
            }

            setTimeout(() => {
                this.socket.off("game_response", failCheck1)
                this.socket.off("ui", failCheck2)
                this.socket.off("eval", caughtCheck)
                this.socket.off("player", failCheck3)
                reject("mine timeout (20000ms)")
            }, 20000)
            this.socket.on("game_response", failCheck1)
            this.socket.on("eval", caughtCheck)
            this.socket.on("ui", failCheck2)
            this.socket.on("player", failCheck3)
        })

        this.socket.emit("skill", { name: "mining" })
        return mined
    }

    public async mluck(target: string): Promise<void> {
        if (!this.ready) throw new Error("We aren't ready yet [mluck].")
        if (target !== this.id) {
            const player = this.players.get(target)
            if (!player) throw new Error(`Could not find ${target} to mluck.`)
            if (player.npc) throw new Error(`${target} is an NPC. You can't mluck NPCs.`)
            if (player.s.mluck && player.s.mluck.strong // They have a strong mluck
                && ((player.owner && player.owner !== this.owner) // If they are public, check if they are from different owners
                    || (player.s.mluck.f !== this.id))) { // Else, rely on the character id
                throw new Error(`${target} has a strong mluck from ${player.s.mluck.f}.`)
            }
        }

        const response = this.getSkillPromise("mluck")
        this.socket.emit("skill", { id: target, name: "mluck" })
        return response
    }

    public async massProduction(): Promise<void> {
        if (!this.ready) throw new Error("We aren't ready yet [massProduction].")
        const massProductioned = new Promise<void>((resolve, reject) => {
            const productedCheck = (data: UIData) => {
                if (data.type == "massproduction" && data.name == this.id) {
                    this.socket.off("ui", productedCheck)
                    resolve()
                }
            }

            setTimeout(() => {
                this.socket.off("ui", productedCheck)
                reject(`massProduction timeout (${Constants.TIMEOUT}ms)`)
            }, Constants.TIMEOUT)
            this.socket.on("ui", productedCheck)
        })

        this.socket.emit("skill", { name: "massproduction" })
        return massProductioned
    }

    // public massProductionPP(): Promise<void> {
    //     const massProductioned = new Promise<void>((resolve, reject) => {
    //         const productedCheck = (data: UIData) => {
    //             if (data.type == "massproductionpp" && data.name == this.id) {
    //                 this.socket.off("ui", productedCheck)
    //                 resolve()
    //             }
    //         }

    //         setTimeout(() => {
    //             this.socket.off("ui", productedCheck)
    //             reject(`massProductionPP timeout (${Constants.TIMEOUT}ms)`)
    //         }, Constants.TIMEOUT)
    //         this.socket.on("ui", productedCheck)
    //     })

    //     this.socket.emit("skill", { name: "massproductionpp" })
    //     return massProductioned
    // }
}
