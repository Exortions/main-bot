import Client from "../struct/Client"
import Discord from "discord.js"
import Args from "../struct/Args"
import Command from "../struct/Command"
import GuildMember from "../struct/discord/GuildMember"
import ActionLog from "../entities/ActionLog"
import Roles from "../util/roles"
import noop from "../util/noop"
import CommandMessage from "../struct/CommandMessage"

export default new Command({
    name: "kick",
    aliases: ["boot", "expell"],
    description: "Kick a member.",
    permission: [Roles.MODERATOR, Roles.MANAGER],
    args: [
        {
            name: "member",
            description: "Member to kick.",
            required: true,
            optionType: "USER"
        },
        {
            name: "image_url",
            description: "Kick image URL.",
            required: false,
            optionType: "STRING"
        },
        {
            name: "reason",
            description: "Kick reason.",
            required: true,
            optionType: "STRING"
        }
    ],
    async run(this: Command, client: Client, message: CommandMessage, args: Args) {
        const user = await args.consumeUser("member")
        if (!user)
            return client.response.sendError(
                message,
                user === undefined ? client.messages.noUser : client.messages.invalidUser
            )
        const member: Discord.GuildMember = await message.guild.members
            .fetch({ user, cache: true })
            .catch(noop)
        if (!member) return client.response.sendError(message, client.messages.notInGuild)

        if (member.user.bot)
            return client.response.sendError(message, client.messages.isBot)
        if (member.id === message.member.user.id)
            return client.response.sendError(message, client.messages.isSelfKick)
        if (GuildMember.hasRole(member, Roles.STAFF))
            return client.response.sendError(message, client.messages.isStaffKick)

        const image = args.consumeImage("image_url")
        const reason = args.consumeRest(["reason"])
        if (!reason) return client.response.sendError(message, client.messages.noReason)

        await message.continue()

        const log = new ActionLog()
        log.action = "kick"
        log.member = user.id
        log.executor = message.member.user.id
        log.reason = reason
        log.reasonImage = image
        log.channel = message.channel.id
        log.message = message.id
        log.length = null
        await log.save()

        await log.notifyMember(client)
        await member.kick(
            reason.length <= 512 ? reason : (await log.contextUrl(client)).href
        )
        await client.response.sendSuccess(message, `Kicked ${user} (**#${log.id}**).`)
        await client.log(log)
    }
})
