import type { Votes } from "#voting";
import {
    EmbedBuilder,
    Message,
    Colors,
    AttachmentBuilder,
} from "discord.js";

export class EmbedHelper {
    private static _handleMessageImage(
        message: Message,
        embed: EmbedBuilder,
        files: AttachmentBuilder[] = [],
        isRef = false
    ): AttachmentBuilder[] {
        const attachmentImage = message.attachments.find(a =>
            a.contentType?.startsWith("image/")
        );
        const embedImageUrl =
            message.embeds.find(e => e.data.image?.url)?.data.image?.url ?? null;

        if (attachmentImage) {
            const filename = attachmentImage.name ?? `${isRef ? 'ref-' : ''}image.png`;
            const attachment = new AttachmentBuilder(attachmentImage.url).setName(filename);

            embed.setImage(`attachment://${filename}`);
            return [...files, attachment];
        }

        if (embedImageUrl) {
            embed.setImage(embedImageUrl);
        }

        return files;
    }

    public static async createNominationEmbeds(
        message: Message,
        voteCounts?: Votes
    ): Promise<{
        embeds: EmbedBuilder[];
        files?: AttachmentBuilder[];
    }> {
        const embeds: EmbedBuilder[] = [];
        let files: AttachmentBuilder[] | undefined;

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

            files = this._handleMessageImage(reference, refEmbed, files, true);
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
        // 3) MAIN MESSAGE IMAGE (attach or remote)
        // ---------------------------------------------------------------------
        files = this._handleMessageImage(message, lead, files);

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

        return { embeds, files: files ?? []};
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
