import type { Votes } from "#voting";
import {
    EmbedBuilder,
    Message,
    Colors,
    AttachmentBuilder,
} from "discord.js";

// Bots can't re-upload files beyond the non-boosted guild limit
const MAX_VIDEO_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export class EmbedHelper {
    private static _handleMessageMedia(
        message: Message,
        embed: EmbedBuilder,
        isRef = false
    ): { files: AttachmentBuilder[]; videoUrls: string[] } {
        const files: AttachmentBuilder[] = [];
        const videoUrls: string[] = [];

        const attachmentImage = message.attachments.find(a =>
            a.contentType?.startsWith("image/")
        );
        const embedImageUrl =
            message.embeds.find(e => e.data.image?.url)?.data.image?.url ?? null;

        if (attachmentImage) {
            const filename = attachmentImage.name ?? `${isRef ? 'ref-' : ''}image.png`;
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
            if (attachmentVideo.size <= MAX_VIDEO_ATTACHMENT_BYTES) {
                const filename = attachmentVideo.name ?? `${isRef ? 'ref-' : ''}video.mp4`;
                files.push(new AttachmentBuilder(attachmentVideo.url).setName(filename));
            } else {
                videoUrls.push(attachmentVideo.url);
            }
        }

        const videoEmbed = message.embeds.find(e => e.data.video?.url);
        const videoSourceUrl = videoEmbed?.data.url ?? videoEmbed?.data.video?.url;
        if (videoSourceUrl) {
            videoUrls.push(videoSourceUrl);
        }

        return { files, videoUrls };
    }

    public static async createNominationEmbeds(
        message: Message,
        voteCounts?: Votes
    ): Promise<{
        embeds: EmbedBuilder[];
        files?: AttachmentBuilder[];
        videoUrls: string[];
    }> {
        const embeds: EmbedBuilder[] = [];
        const files: AttachmentBuilder[] = [];
        const videoUrls: string[] = [];

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
            const refEmbed = new EmbedBuilder()
                .setColor(Colors.Blurple)
                .setAuthor({
                    name: reference.author.displayName,
                    iconURL: reference.author.displayAvatarURL()
                })
                .setTimestamp(reference.createdTimestamp);

            if (reference.content) {
                refEmbed.setDescription(reference.content.slice(0, 4096));
            }

            const refMedia = this._handleMessageMedia(reference, refEmbed, true);
            files.push(...refMedia.files);
            videoUrls.push(...refMedia.videoUrls);
            embeds.push(refEmbed);
        }

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
        videoUrls.push(...media.videoUrls);

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

        return { embeds, files, videoUrls };
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
