import { User, Message, TextChannel, ThreadChannel } from "discord.js";

export class GreetingHelper {
    public static generalChannelGreeting(
        channel: TextChannel | ThreadChannel,
        user: User,
        message: Message
    ): string {
        const replies = [
            `Hey there, Nordevians! 🌟 ${user} just nominated a gem from ${channel.name} by ${message.author} for our 🏆best of list🏆. What's your take on it?`,
            `Looks like ${user} is on the prowl for greatness! They've nominated ${message.author}'s post in ${channel.name} for our 🏆best of list🏆. What's your verdict?`,
            `It's nomination time! 🏅 ${user} thinks ${message.author}'s message in ${channel.name} deserves a spot in the 🏆best of list🏆. What's your say?`,
            `${user} is playing judge today! They've nominated ${message.author}'s post in ${channel.name} for our prestigious 🏆best of list🏆. Share your thoughts!`,
            `Attention, everyone! 📢 ${user} believes that ${message.author}'s message in ${channel.name} is worthy of our 🏆best of list🏆. What's your opinion?`,
            `🔔 Nomination alert! ${user} has singled out a message from ${message.author} in ${channel.name} for the 🏆best of list🏆. What do you think?`,
            `${user} has nominated a contender! 🌟 Check out ${message.author}'s post in ${channel.name} and tell us if it deserves a spot in our 🏆best of list🏆.`,
            `It's nomination time, and ${user} is leading the way! They've nominated ${message.author}'s post in ${channel.name} for the prestigious 🏆best of list🏆. What's your verdict?`,
            `🌠 ${user} just nominated a message from ${message.author} over in ${channel.name}. Is it worthy of a place in the 🏆best of list🏆?`,
            `Big news! 📢 ${user} has nominated a message by ${message.author} from ${channel.name} for our 🏆best of list🏆. What's your take on this nomination?`,
            `${user} has spotlighted ${message.author}'s post in ${channel.name} as a potential champion for our 🏆best of list🏆. Share your thoughts!`,
            `Attention all! 📣 ${user} has nominated ${message.author}'s message in ${channel.name} for our esteemed 🏆best of list🏆. What's your verdict?`,
            `🌟 ${user} brings exciting news! They've nominated ${message.author}'s post in ${channel.name} for our distinguished 🏆best of list🏆. What do you think?`,
            `${user} just ignited the nomination fire! They've put forward ${message.author}'s post in ${channel.name} for our coveted 🏆best of list🏆. Share your opinion!`,
            `🔥 ${user} believes ${message.author}'s message in ${channel.name} has the spark for our 🏆best of list🏆. What's your take on this nomination?`,
            `${user} is raising the bar! They've selected ${message.author}'s post in ${channel.name} for potential inclusion in our 🏆best of list🏆. What's your verdict?`,
            `✨ Big announcement! ${user} has nominated ${message.author}'s message in ${channel.name} for our prestigious 🏆best of list🏆. What's your opinion?`,
            `🏅 ${user} just nominated a standout from ${message.author} in ${channel.name} for our coveted 🏆best of list🏆. What do you think?`,
            `Breaking news! 📰 ${user} has championed ${message.author}'s post in ${channel.name} for our renowned 🏆best of list🏆. Share your thoughts!`,
            `${user} just proposed ${message.author}'s message in ${channel.name} as a contender for our esteemed 🏆best of list🏆. What's your verdict?`
        ];

        const randomIndex = Math.floor(Math.random() * replies.length);

        if (replies[randomIndex] === null || replies[randomIndex] === undefined) {
            return "Hey! A message has been nominated for the best of list. What do you think about it?";
        }

        return replies[randomIndex];
    }
}
