import Client from "../struct/Client"
import Args from "../struct/Args"
import Command from "../struct/Command"
import Roles from "../util/roles"
import hexToRGB from "../util/hexToRGB"
import Discord from "discord.js"
import ApiTypes from "discord-api-types"
import CommandMessage from "../struct/CommandMessage"

export default new Command({
    name: "unlock",
    aliases: [],
    description: "Unlock the channel.",
    permission: Roles.MANAGER,
    args: [
        {
            name: "channel",
            description: "The channel to unlock",
            required: false,
            optionType: "CHANNEL",
            channelTypes: [ApiTypes.ChannelType.GuildText]
        }
    ],
    async run(this: Command, client: Client, message: CommandMessage, args: Args) {
        const channel =
            (await args.consumeChannel("channel")) ||
            (message.channel as Discord.TextChannel)
        /*eslint-disable */
        const reason = `By ${message.member.user.tag} (${message.member.id})`
        /*eslint-enable */
        await (channel as Discord.TextChannel).permissionOverwrites.edit(
            message.guild.id,
            { SEND_MESSAGES: null }
        ) // There is no non-hacky reason support here now

        await client.response.sendSuccess(message, `Unlocked ${channel}.`)
        await client.log({
            color: hexToRGB(client.config.colors.success),
            author: { name: "Unlocked" },
            description: `Channel ${channel} unlocked by ${message.member}.`
        })
    }
})
