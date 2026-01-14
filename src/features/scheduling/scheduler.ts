import { SchedulingService } from './service.js';
import { getDueGuilds, updateNextPostTime, getRecapEnabledGuilds } from './queries.js';

export class Scheduler {
  private schedulingService: SchedulingService;
  private interval: NodeJS.Timeout | null = null;
  private lastRecapCheck: Date | null = null;

  constructor(schedulingService: SchedulingService) {
    this.schedulingService = schedulingService;
  }

  start() {
    // Run every five minutes
    this.interval = setInterval(() => this.checkTasks(), 300 * 1000);
    console.log('Scheduler started.');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('Scheduler stopped.');
    }
  }

  private async checkTasks() {
    await this.handleRandomPosts();
    await this.handleMonthlyRecaps();
  }

  private async handleRandomPosts() {
    console.log('Scheduler checking for due posts...');
    const dueGuilds = await getDueGuilds();

    if (dueGuilds.length > 0) {
      console.log(`Found ${dueGuilds.length} guild(s) with due posts.`);
    }

    for (const guild of dueGuilds) {
      try {
        await this.schedulingService.postRandomNomination(guild.guild_id);

        const now = new Date();
        let nextPostTime = new Date();
        switch (guild.random_post_schedule) {
          case 'daily':
            nextPostTime.setDate(now.getDate() + 1);
            break;
          case 'every_other_day':
            nextPostTime.setDate(now.getDate() + 2);
            break;
          case 'weekly':
            nextPostTime.setDate(now.getDate() + 7);
            break;
        }
        nextPostTime.setHours(9, 0, 0, 0);

        await updateNextPostTime(guild.guild_id, nextPostTime);
        console.log(`Posted for guild ${guild.guild_id} and scheduled next post for ${nextPostTime.toISOString()}`);
      } catch (error) {
        console.error(`Error processing scheduled post for guild ${guild.guild_id}:`, error);
      }
    }
  }

  private async handleMonthlyRecaps() {
    const now = new Date();
    // Check if it's the first day of the month
    if (now.getDate() === 1) {
        // To prevent running this multiple times on the same day, check if the last run was on a different day
        if (this.lastRecapCheck && this.lastRecapCheck.getDate() === 1 && this.lastRecapCheck.getMonth() === now.getMonth()) {
            return;
        }

        console.log('Scheduler checking for monthly recaps...');
        const recapGuilds = await getRecapEnabledGuilds();
        for (const guild of recapGuilds) {
            try {
                await this.schedulingService.postMonthlyRecap(guild.guild_id);
            } catch (error) {
                console.error(`Error processing monthly recap for guild ${guild.guild_id}:`, error);
            }
        }
        this.lastRecapCheck = now;
    }
  }
}
