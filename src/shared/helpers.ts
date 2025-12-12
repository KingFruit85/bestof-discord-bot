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
            `${user} just proposed ${message.author}'s message in ${channel.name} as a contender for our esteemed 🏆best of list🏆. What's a your verdict?`
        ];

        const randomIndex = Math.floor(Math.random() * replies.length);

        if (replies[randomIndex] === null || replies[randomIndex] === undefined) {
            return "Hey! A message has been nominated for the best of list. What do you think about it?";
        }

        return replies[randomIndex];
    }

    public static crosspostGreeting(
        originalChannel: TextChannel | ThreadChannel,
        user: User,
        message: Message
    ): string {
        return `A new nomination from #${originalChannel.name} by ${user} for ${message.author}'s message!`;
    }

    public static userNominatingOwnMessage(
        channel: TextChannel | ThreadChannel,
        user: User,
        message: Message
    ): string {
        const replies = [
            `Oh, look, ${user} is so proud of their own message they had to nominate it themselves! Let's all give them a round of applause for their self-love!`,
            `Did everyone see that? ${user} just tried to nominate their own message! How embarrassing!`,
            `Attention, please! ${user} thinks their message is so great, they've nominated it for the 'best of' list. Let's all point and laugh!`,
            `Could someone please tell ${user} that nominating your own message is like giving yourself a high-five? It just looks sad.`,
            `C'mon, ${user}, really? Nominating your own message? That's just not how we do things here.`,
            `Wow, ${user}. Just... wow. Nominating your own message is a bold move. A very, very bold move.`,
            `Is there an award for 'Most Shameless Self-Promoter'? If so, I nominate ${user} for nominating their own message!`,
            `Hey, ${user}, did you forget the rules? No self-nominations! Or did you just think we wouldn't notice?`,
            `Alert! Alert! ${user} has reached peak cringe by nominating their own message!`,
            `I'm not saying ${user} is desperate for attention, but they did just nominate their own message.`
        ];

        const randomIndex = Math.floor(Math.random() * replies.length);

        if (replies[randomIndex] === null || replies[randomIndex] === undefined) {
            return `Lol ${user}, tried to nominate their own message, lets all point and laugh!`;
        }

        return replies[randomIndex];
    }

    public static randomNominationMessage(
        user: User,
    ): string {
        const replies = [
            `🦀 Here's a gem of ${user}'s I've dug up from the archives for your enjoyment today! 🦀`,
            `🦀 Rise and shine with today's blast from the past! ${user} brings you a classic moment! 🦀`,
            `🦀 Your daily dose of Nordev brilliance has arrived! Enjoy this highlight from ${user}! 🦀 `,
            `🦀 Starting the day with this memorable moment from our history!, courtesy of ${user}! 🦀 `,
            `🦀 Good morning you absolute beauts! Enjoy this highlight from our community's greatest hits!, brought to you by ${user}! 🦀`,
            `🦀 Today's featured comment from the Nordev vault has arrived! courtesy of ${user}! 🦀 `,
            `🦀 Kicking off the day with this standout moment of ${user}'s from our archives! 🦀`,
            `🦀 Look what I found in our treasure trove of great messages! 🦀`,
            `🦀 Your daily Nordev nostalgia is served! 🦀`,
            `🦀 Time for your daily reminder of why this community (and specifically ${user}) is awesome! 🦀`,
            `🦀 Coming at you with today's handpicked Nordev lore! 🦀`,
            `🦀 Today's featured message is quite the treat! Thanks ${user}! 🦀`,
            `🦀 And now, for your daily moment of Nordev brilliance... 🦀`,
            `🦀 I've searched through the archives to bring you today's highlight! 🦀`,
            `🦀 Is the the beautiful tones and melodies of world famous and unanimously loved band HEALTH I hear? oh my mistake, it's just a comment from ❤️ ${user} ❤️`,
            `🦀 Is that the sweet smell of Sheridan's hams? No? Oh it's today's featured comment! 🦀`,
            `🦀 Your daily reminder of the amazing conversations happening here! 🦀`,
            `🦀 Hot off the archives: ${user}'s featured community moment! 🦀`,
            `🦀 Behold! Today's gem from the Nordev collection has arrived! 🦀`,
            `🦀 Start your day right with this classic moment from our community! 🦀`,
            `🦀 The algorithm has spoken! ${user} has calimed victory for today's featured message! 🦀`,
            `🦀 My daily treasure hunt through the archives yielded this gem! 🦀`,
            `🦀 Community spotlight time! Check out today's featured message! 🦀`,
            `🦀 Surprise! Is it a MattB kickflip special? no it's a comment from ${user}! 🦀`,
            `🦀 Looking for inspiration? Here's today's message from the archives! 🦀`,
            `🦀 Need a break from Sam banging on about Labour or Star Citizen? Don't blame you, get your peepers on this nominated post from ${user}! 🦀`,
            `🦞 Nordev time capsule: Bringing you this classic from our archives! 🦞`,
            `🦀 That's enough reviewing mince pies! Review this ocular delicacy instead! 🦀`,
            `🦀 No it's not some random tat from the FooBar shop! It's today's featured message! 🦀`
        ];

        const randomIndex = Math.floor(Math.random() * replies.length);

        if (replies[randomIndex] === null || replies[randomIndex] === undefined) {
            return "Here's a recap of the month! 🎉";
        }

        return replies[randomIndex];
    }

    public static monthlyRecapMessage(
    ): string {
        const replies = [
            "Here's a recap of the month! 🎉",
            "Can you believe it's already the end of the month? Here's what happened! 📅",
            "As we wrap up the month, let's take a look at some highlights! 🌟",
            "The month has flown by! Check out these memorable moments! 🕒",
            "Time flies when you're having fun! Here's a recap of the month! ⏰",
            "What a month it's been! Let's relive some of the best moments! 🏆",
            "As we close out the month, let's celebrate some of our best moments! 🎊",
            "The month is coming to an end! Here's a look back at some highlights! 📸",
            "It's time for our monthly recap! Let's see what we've accomplished! 📈",
            "The month has come to a close! Here's a look at some of our best moments! 🏅",
            "As we bid farewell to the month, let's celebrate some of our best moments! 🎉",
            "The month has flown by! Let's take a look at some of our best moments! 🕒",
        ];

        const randomIndex = Math.floor(Math.random() * replies.length);

        if (replies[randomIndex] === null || replies[randomIndex] === undefined) {
            return "Here's a recap of the month! 🎉";
        }

        return replies[randomIndex];
    }
}
