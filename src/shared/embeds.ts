import type { Votes } from "#voting";
import {
    EmbedBuilder,
    Message,
    Colors,
    AttachmentBuilder,
} from "discord.js";

// Bots can't re-upload files beyond the non-boosted guild limit
const MAX_MEDIA_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export class EmbedHelper {
    private static _handleMessageMedia(
        message: Message,
        embed: EmbedBuilder,
        namePrefix = ""
    ): { files: AttachmentBuilder[]; mediaUrls: string[] } {
        const files: AttachmentBuilder[] = [];
        const mediaUrls: string[] = [];

        const attachmentImage = message.attachments.find(a =>
            a.contentType?.startsWith("image/")
        );
        const embedImageUrl =
            message.embeds.find(e => e.data.image?.url)?.data.image?.url ?? null;

        if (attachmentImage) {
            const filename = attachmentImage.name ?? `${namePrefix}image.png`;
            files.push(new AttachmentBuilder(attachmentImage.url).setName(filename));
            embed.setImage(`attachment://${filename}`);
        } else if (embedImageUrl) {
            embed.setImage(embedImageUrl);
        }

        // The API ignores the video field on bot-sent embeds, so videos must
        // travel outside the embeds: small attachments are re-uploaded (Discord
        // renders a player), everything else is surfaced as a URL for the
        // caller to put in the message content where Discord unfurls it.
        const attachmentVideo = message.attachments.find(a =>
            a.contentType?.startsWith("video/")
        );

        if (attachmentVideo) {
            if (attachmentVideo.size <= MAX_MEDIA_ATTACHMENT_BYTES) {
                const filename = attachmentVideo.name ?? `${namePrefix}video.mp4`;
                files.push(new AttachmentBuilder(attachmentVideo.url).setName(filename));
            } else {
                mediaUrls.push(attachmentVideo.url);
            }
        }

        const videoEmbed = message.embeds.find(e => e.data.video?.url);
        const videoSourceUrl = videoEmbed?.data.url;
        if (videoSourceUrl) {
            mediaUrls.push(videoSourceUrl);
        }

        const attachmentAudio = message.attachments.find(a => a.contentType?.startsWith("audio/"))
        const audioSourceUrl = attachmentAudio?.url ?? attachmentAudio?.proxyURL;

        if (attachmentAudio) {
            if (attachmentAudio.size <= MAX_MEDIA_ATTACHMENT_BYTES) {
                const filename = attachmentAudio.name ?? `${namePrefix}audio.ogg`
                files.push(new AttachmentBuilder(attachmentAudio.url).setName(filename));
            } else {
                if (audioSourceUrl) {
                    mediaUrls.push(audioSourceUrl)
                }
            }
        }

        return { files, mediaUrls };
    }

    private static _buildContextEmbed(
        msg: Message,
        namePrefix = ""
    ): { embed: EmbedBuilder; files: AttachmentBuilder[]; mediaUrls: string[] } {
        const embed = new EmbedBuilder()
            .setColor(Colors.Blurple)
            .setAuthor({
                name: msg.author.displayName,
                iconURL: msg.author.displayAvatarURL()
            })
            .setTimestamp(msg.createdTimestamp);

        if (msg.content) {
            embed.setDescription(msg.content.slice(0, 4096));
        }

        const media = this._handleMessageMedia(msg, embed, namePrefix);
        return { embed, files: media.files, mediaUrls: media.mediaUrls };
    }

    public static async createNominationEmbeds(
        message: Message,
        voteCounts?: Votes,
        contextMessages: Message[] = []
    ): Promise<{
        embeds: EmbedBuilder[];
        files?: AttachmentBuilder[];
        mediaUrls: string[];
    }> {
        const embeds: EmbedBuilder[] = [];
        const files: AttachmentBuilder[] = [];
        const mediaUrls: string[] = [];

        // ---------------------------------------------------------------------
        // 1) REFERENCED MESSAGE EMBED (if the nominated message is a reply)
        // ---------------------------------------------------------------------
        let reference: Message | null = null;

        try {
            if (message.reference && message.reference.messageId) {
                reference = await message.fetchReference().catch(() => null);
            }
        } catch {
            reference = null;
        }

        if (reference) {
            const built = this._buildContextEmbed(reference, "ref-");
            files.push(...built.files);
            mediaUrls.push(...built.mediaUrls);
            embeds.push(built.embed);
        }

        // ---------------------------------------------------------------------
        // 1b) USER-SELECTED CONTEXT MESSAGES (oldest-first)
        // ---------------------------------------------------------------------
        contextMessages.forEach((contextMessage, index) => {
            const built = this._buildContextEmbed(contextMessage, `ctx-${index}-`);
            files.push(...built.files);
            mediaUrls.push(...built.mediaUrls);
            embeds.push(built.embed);
        });

        // ---------------------------------------------------------------------
        // 2) NOMINATED MESSAGE
        // ---------------------------------------------------------------------
        const lead = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setAuthor({
                name: message.author.displayName,
                iconURL: message.author.displayAvatarURL()
            })
            .setTimestamp(message.createdTimestamp);

        if (message.content) {
            lead.setDescription(message.content.slice(0, 4096));
        }

        // ---------------------------------------------------------------------
        // 3) MAIN MESSAGE MEDIA (attach, remote image, or video)
        // ---------------------------------------------------------------------
        const media = this._handleMessageMedia(message, lead);
        files.push(...media.files);
        mediaUrls.push(...media.mediaUrls);

        embeds.push(lead);


        // ---------------------------------------------------------------------
        // 4) TAIL EMBED (Nominator + Author) THIS MUST BE LAST
        // ---------------------------------------------------------------------
        const tail = new EmbedBuilder()
            .addFields(
                {
                    name: "Up votes",
                    value: voteCounts ? String(voteCounts.up_votes) : "1",
                    inline: true
                },
                {
                    name: "Down votes",
                    value: voteCounts ? String(voteCounts.down_votes) : "0",
                    inline: true
                },
                {
                    name: "🔗 Message Link",
                    value: `[Jump to message](${message.url})`
                }
            )
            .setThumbnail(message.author.displayAvatarURL());

        embeds.push(tail);

        return { embeds, files, mediaUrls };
    }

    public static getUpdatedTailEmbed(
        tailEmbed: EmbedBuilder,
        upvotes: number,
        downvotes: number
    ): EmbedBuilder {
        const updatedFields = tailEmbed.data.fields?.map((field) => {
            if (field.name === "Up votes") {
                return { ...field, value: upvotes.toString() };
            }
            if (field.name === "Down votes") {
                return { ...field, value: downvotes.toString() };
            }
            return field;
        });

        tailEmbed.setFields(updatedFields || []);
        return tailEmbed;
    }
}
