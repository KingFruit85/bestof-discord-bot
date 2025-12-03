-- Nominations table
CREATE TABLE IF NOT EXISTS nominations (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    message_link TEXT NOT NULL UNIQUE,
    nominator VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nominations_guild_id ON nominations(guild_id);
CREATE INDEX IF NOT EXISTS idx_nominations_created_at ON nominations(created_at);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    nomination_id INTEGER NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
    voter_id VARCHAR(20) NOT NULL,
    vote_value SMALLINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(nomination_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_nomination_id ON votes(nomination_id);

-- Guild config table
CREATE TABLE IF NOT EXISTS guild_config (
    guild_id VARCHAR(20) PRIMARY KEY,
    nomination_channel VARCHAR(20),
    allow_crossposts BOOLEAN DEFAULT false,
    random_post_schedule VARCHAR(20),
    enable_monthly_recap BOOLEAN DEFAULT false,
    next_random_post TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedule history table
CREATE TABLE IF NOT EXISTS schedule_history (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    message_link TEXT NOT NULL,
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedule_history_guild_id ON schedule_history(guild_id);
CREATE INDEX IF NOT EXISTS idx_schedule_history_posted_at ON schedule_history(posted_at);