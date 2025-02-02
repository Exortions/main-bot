import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    DeleteDateColumn,
    BaseEntity,
    LessThan
} from "typeorm"
import SnowflakeColumn from "./decorators/SnowflakeColumn"
import Discord from "discord.js"
import path from "path"
import Client from "../struct/Client"
import { loadSyncJSON5 } from "../util/loadJSON5"
import replaceAsync from "../util/replaceAsync"
const suggestionStatusActions = loadSyncJSON5(
    path.join(__dirname + "../../../config/extensions/suggestionStatusActions.json5")
)
import hexToRGB from "../util/hexToRGB"

export type SuggestionStatus = keyof typeof SuggestionStatuses
export enum SuggestionStatuses {
    "approved",
    "denied",
    "duplicate",
    "forwarded",
    "in-progress",
    "information",
    "invalid"
}

export interface Identifier {
    number: number
    extension: string
}

@Entity({ name: "suggestions" })
export default class Suggestion extends BaseEntity {
    static ALPHABET = "abcdefghijklmnopqrstuvwxyz"

    @PrimaryGeneratedColumn()
    id: number

    @Column({ nullable: true })
    number?: number

    @Column({ nullable: true })
    extends?: number

    @SnowflakeColumn()
    author: string

    @Column()
    anonymous: boolean

    @Column()
    title: string

    @Column({ length: 2048 })
    body: string

    @Column({ nullable: true })
    teams?: string

    @Column({ nullable: true })
    status?: SuggestionStatus

    @SnowflakeColumn({ nullable: true, name: "status_updater" })
    statusUpdater?: string

    @Column({ nullable: true, length: 1024, name: "status_reason" })
    statusReason?: string

    @SnowflakeColumn()
    message: string

    @SnowflakeColumn({ nullable: true })
    thread: string

    @Column()
    staff: boolean

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date

    @DeleteDateColumn({ name: "deleted_at" })
    deletedAt: Date

    @SnowflakeColumn({ nullable: true })
    deleter?: string

    static async findNumber(staff: boolean, client: Client): Promise<number> {
        const field = staff ? "staff" : "main"
        const existing = await this.count({
            where: {
                staff: staff,
                extends: null
            },
            withDeleted: true
        })

        return existing + client.config.suggestionOffset[field]
    }

    async getIdentifier(): Promise<string> {
        if (!this.extends) {
            return this.number.toString()
        } else {
            const extenders = await Suggestion.find({
                extends: this.extends,
                createdAt: LessThan(this.createdAt || new Date())
            })
            const letter = Suggestion.ALPHABET[extenders.length + 1]
            return this.extends + letter
        }
    }

    static async findByIdentifier(
        identifier: Identifier,
        staff: boolean
    ): Promise<Suggestion> {
        if (!identifier.extension)
            return await this.findOne({ number: identifier.number, staff })

        const extensionNumber = Suggestion.ALPHABET.indexOf(identifier.extension) - 1
        return await Suggestion.getRepository()
            .createQueryBuilder("suggestion")
            .withDeleted()
            .where("suggestion.extends = :extends", { extends: identifier.number })
            .andWhere("suggestion.staff = :staff", { staff })
            .orderBy("suggestion.created_at", "ASC")
            .skip(extensionNumber)
            .take(1) // required for skip()
            .getOne()
    }

    static parseIdentifier(input: string): Identifier {
        input = input
            .trim()
            .replace(/^\*?\*?#?/, "")
            .replace(/:?\*?\*?:?$/, "")
        const number = Number(input.match(/\d+/)?.[0])
        const extensionMatch = input.match(/[b-z]$/i)?.[0]
        const extension = extensionMatch ? extensionMatch.toLowerCase() : null
        return { number, extension }
    }

    static isIdentifier(input: string): boolean {
        const identifier = Suggestion.parseIdentifier(input)
        return !!identifier.number && !!identifier.extension
    }

    getURL(client: Client): string {
        const category = this.staff ? "staff" : "main"
        const guild = client.config.guilds[category]
        const channel = client.config.suggestions[category]
        const message = this.message
        return `https://discord.com/channels/${guild}/${channel}/${message}`
    }

    async displayEmbed(client: Client): Promise<Discord.MessageEmbedOptions> {
        const identifier = await this.getIdentifier()

        if (this.deletedAt) {
            const deleter =
                this.deleter === this.author ? "the author" : `<@${this.deleter}>`
            return {
                color: hexToRGB(client.config.colors.error),
                description: `**#${identifier}**: The suggestion has been deleted by ${deleter}.`
            }
        }

        const embed: Discord.MessageEmbedOptions = {
            color: "#999999",
            author: { name: `#${identifier} — ${this.title}` },
            thumbnail: { url: null },
            description: this.body,
            fields: []
        }

        if (!this.anonymous) {
            embed.fields.push({ name: "Author", value: `<@${this.author}>` })
            if (!this.status) {
                const author = client.users.cache.get(this.author)
                if (author) {
                    embed.thumbnail.url = author.displayAvatarURL({
                        size: 128,
                        format: "png",
                        dynamic: true
                    })
                }
            }
        }
        if (this.teams) embed.fields.push({ name: "Team/s", value: this.teams })

        if (this.status) {
            embed.color = hexToRGB(client.config.colors.suggestions[this.status])
            embed.thumbnail.url = client.config.assets.suggestions[this.status]

            let action = suggestionStatusActions[this.status] as string
            let reason = this.statusReason || ""
            let refers = ""
            if (["forwarded", "duplicate"].includes(this.status)) {
                const prep = { forwarded: "to", duplicate: "of" }[this.status]
                // "to/of ($1). ($2)"
                const regex = new RegExp(`^${prep}\\s+([^.]+)(?:\\.\\s+)?(.+)?`, "i")
                const match = reason.match(regex)
                if (match) {
                    refers = ` ${prep} ${match[1]}`
                    reason = match[2] || ""
                    if (this.status === "forwarded")
                        action = action.replace("to the respective team", "")
                }
            }

            // link suggestion numbers
            const regex = /#?\d+[a-z]?/gi
            const replacer = async (input: string) => {
                const identifier = Suggestion.parseIdentifier(input)
                // prettier-ignore
                const suggestion = await Suggestion.findByIdentifier(identifier, this.staff)
                if (!suggestion) return input
                return `[${input}](${suggestion.getURL(client)})`
            }

            refers = await replaceAsync(refers, regex, replacer)
            reason = await replaceAsync(reason, regex, replacer)

            embed.fields.push({
                name: "Status",
                value: `*${action}${refers} by <@${this.statusUpdater}>.*\n\n${reason}`
            })
        }

        return embed
    }
}
