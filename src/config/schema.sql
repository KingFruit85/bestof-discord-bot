-- Nominations table
CREATE TABLE IF NOT EXISTS nominations (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    message_link TEXT NOT NULL UNIQUE,
    nominator VARCHAR(20) NOT NULL,
    nomination_message_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nominations_guild_id ON nominations(guild_id);
CREATE INDEX IF NOT EXISTS idx_nominations_created_at ON nominations(created_at);
CREATE INDEX IF NOT EXISTS idx_nominations_nomination_message_id ON nominations(nomination_message_id);

ALTER TABLE nominations ADD COLUMN IF NOT EXISTS context_message_links TEXT[];

-- Discord user ID of whoever wrote the nominated message. Added 2026-11-08;
-- older rows were filled by `npm run backfill-authors`, and stay NULL where
-- the message was already deleted.
ALTER TABLE nominations ADD COLUMN IF NOT EXISTS author_id VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_nominations_author_id ON nominations(author_id);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    nomination_id INTEGER NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
    voter_id VARCHAR(20) NOT NULL,
    vote_value SMALLINT NOT NULL,
    source VARCHAR(10) NOT NULL DEFAULT 'button',
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

-- 'posted' or 'skipped' (message could not be fetched). Skips don't count
-- toward the reset threshold. Added 2026-11-07; earlier rows read 'posted'.
ALTER TABLE schedule_history ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'posted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'nominations' AND column_name = 'waiting_since'
  ) THEN
    ALTER TABLE nominations ADD COLUMN waiting_since TIMESTAMP;
    UPDATE nominations n
    SET waiting_since = GREATEST(
      n.created_at + interval '30 days',
      COALESCE((SELECT min(sh.posted_at) FROM schedule_history sh WHERE sh.guild_id = n.guild_id), NOW())
    );
  END IF;
END
$$;