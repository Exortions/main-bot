import chalk from "chalk"
import Discord from "discord.js"
import BannerImage from "../entities/BannerImage"
import TimedPunishment from "../entities/TimedPunishment"
import AdvancedBuilder from "../entities/AdvancedBuilder"
import Client from "../struct/Client"
import Guild from "../struct/discord/Guild"
import Reminder from "../entities/Reminder"
import BlunderTracker from "../entities/BlunderTracker"

export default async function ready(this: Client): Promise<void> {
    this.logger.debug("Loading commands...")
    await this.commands.load()
    this.logger.info("Loaded commands.")

    const activity = `with ${(await this.customGuilds.main()).memberCount} users`
    this.user.setActivity(activity, { type: "PLAYING" })

    // schedule punishment undoings, banner queue cycles, the blunder tracker interval, and advanced builder removals!
    BannerImage.schedule(this)
    for (const punishment of await TimedPunishment.find()) punishment.schedule(this)
    for (const builder of await AdvancedBuilder.find()) builder.schedule(this)
    for (const reminder of await Reminder.find()) reminder.schedule(this)
    setInterval(() => BlunderTracker.inc(this), 86400000)

    // cache reaction role messages
    for (const channelID of Object.keys(this.config.reactionRoles)) {
        const channel: Discord.TextChannel = await this.channels
            .fetch(channelID)
            .catch(() => null)
        if (channel) {
            for (const messageID of Object.keys(this.config.reactionRoles[channelID])) {
                await channel.messages.fetch(messageID).catch(() => null)
            }
        }
    }

    if ((await this.customGuilds.main()).features.includes("VANITY_URL")) {
        const current = await (await this.customGuilds.main()).fetchVanityData()
        const outdated = current?.code !== this.config.vanity
        if (outdated) {
            const reason = "Reached level 3 boosting"
            await Guild.setVanityCode(
                await this.customGuilds.main(),
                this.config.vanity,
                reason
            )

            const pink = chalk.hex("#FF73FA")
            this.logger.info(`Set vanity code to ${pink(this.config.vanity)}.`)
        }
    }
    if (this.config.jenkinsEnv) {
        this.logger.info("Jenkins run successful")
        process.exit(0)
    }
}
