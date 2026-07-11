import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  JIRA_HOST: z.url(),
  JIRA_EMAIL: z.email(),
  JIRA_API_TOKEN: z.string().min(1),
  JIRA_PROJECT_KEY: z.string().min(1),
  JIRA_DEFAULT_JQL: z.string().min(1),
  LEAD_TIME_START_MODE: z.enum(['created', 'fieldDate', 'boardColumn']).default('boardColumn'),
  LEAD_TIME_START_FIELD_ID: z.string().default('customfield_pronto_para_desenvolvimento'),
  LEAD_TIME_START_FIELD_NAME: z.string().default('Pronto para Desenvolvimento'),
  LEAD_TIME_BOARD_ID: z.coerce.number().int().positive().default(1),
  LEAD_TIME_START_COLUMN_NAME: z.string().default('Pronto para Desenvolvimento'),
  LEAD_TIME_END_COLUMN_NAME: z.string().default('Em Produção'),
  POSTGRES_URL: z.string().min(1),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379)
});

export const env = envSchema.parse(process.env);
