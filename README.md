# Best-Of Discord Bot

A Discord bot for nominating and showcasing the best messages in your server.

## Overview

This bot allows server members to nominate messages for a "best-of" collection. Nominated messages are then randomly posted to a designated channel on a schedule, creating a highlight reel of your community's best moments. The bot also supports monthly recaps of all nominations.

## Features

- **Message Nominations**: Easily nominate any message to be included in the best-of collection.
- **Scheduled Posts**: Automatically posts a random nomination to a configured channel on a recurring schedule.
- **Monthly Recaps**: Opt-in to receive a monthly summary of all nominations from the previous month.
- **Configurable**: Server administrators can set the nomination channel, posting schedule, and other options.
- **Voting System**: Members can upvote or downvote nominations.

## Commands

The bot uses a combination of a slash command and a context menu command for a seamless user experience.

### `/configure`

- **Usage**: `/configure`
- **Description**: Allows a server administrator to configure the bot's settings for the server. This includes setting the nomination channel, the random posting schedule, and enabling/disabling features like monthly recaps.
- **Permissions**: Requires Administrator permissions.

### Add Nomination (Message Context Menu)

- **Usage**: Right-click on any message -> Apps -> Add Nomination
- **Description**: Nominates the selected message. The bot will react to the message to confirm the nomination and allow voting.

## Configuration

1.  **Invite the Bot**: Invite the bot to your Discord server.
2.  **Run `/configure`**: An administrator must run the `/configure` command to open the settings panel.
3.  **Set Nomination Channel**: In the configuration panel, select the channel where you want the "best-of" nominations to be posted.
4.  **Set Posting Schedule**: Choose how often you want the bot to post a random nomination.
5.  **(Optional) Enable Recaps**: You can choose to enable a monthly recap post that summarizes all nominations from the past month.

## Self-Hosting

This application is built with Node.js and TypeScript. To run it yourself:

1.  **Clone the Repository**:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Variables**: Create a `.env` file in the root of the project and add the following variables:
    ```
    DISCORD_TOKEN=your_discord_bot_token
    DATABASE_URL=your_postgresql_database_url
    ```
4.  **Initialize the Database**: Run the database schema initialization script:
    ```bash
    npm run init-db
    ```
5.  **Register Commands**:
    ```bash
    npm run register
    ```
6.  **Build and Run**:
    - To run in a development environment with live reloading:
      ```bash
      npm run dev
      ```
    - To build and run the production version:
      ```bash
      npm run build
      npm run start
      ```
### Deployment

The project includes a `Dockerfile` and a `fly.toml` for easy deployment to [Fly.io](https://fly.io/).
