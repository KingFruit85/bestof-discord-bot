import { query } from '../../config/database.js';

export interface GuildConfig {
  guild_id: string;
  nomination_channel: string | null;
  allow_crossposts: boolean;
  random_post_schedule: string | null;
  enable_monthly_recap: boolean;
  next_random_post: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function getGuildConfig(
  guildId: string
): Promise<GuildConfig | null> {
  const result = await query<GuildConfig>(
    'SELECT * FROM guild_config WHERE guild_id = $1',
    [guildId]
  );
  return result.rows[0] || null;
}

export async function getNominationChannel(
  guildId: string
): Promise<string | null> {
  const result = await query<{ nomination_channel: string }>(
    'SELECT nomination_channel FROM guild_config WHERE guild_id = $1',
    [guildId]
  );
  return result.rows[0]?.nomination_channel || null;
}

export async function upsertGuildConfig(
  guildId: string,
  config: Partial<Omit<GuildConfig, 'guild_id' | 'created_at' | 'updated_at'>>
): Promise<GuildConfig> {
  const existingConfig = await getGuildConfig(guildId);

  let queryString: string;
  const params: any[] = [];

  if (existingConfig) {
    const updates = Object.entries(config)
      .map(([key, value], i) => {
        params.push(value);
        return `${key} = $${i + 1}`;
      })
      .join(', ');
    params.push(guildId);
    queryString = `UPDATE guild_config SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE guild_id = $${params.length} RETURNING *`;
  } else {
    const columns = ['guild_id'];
    const values = ['$1'];
    params.push(guildId);

    Object.entries(config).forEach(([key, value], i) => {
      columns.push(key);
      values.push(`$${i + 2}`);
      params.push(value);
    });

    queryString = `INSERT INTO guild_config (${columns.join(
      ', '
    )}) VALUES (${values.join(', ')}) RETURNING *`;
  }

  const result = await query<GuildConfig>(queryString, params);

  if (result.rows.length === 0 || result.rows[0] == undefined) {
    throw new Error('Failed to upsert guild config');
  }
  return result.rows[0];
}
