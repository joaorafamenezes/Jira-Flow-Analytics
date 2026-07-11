import { Version3Client } from 'jira.js';
import { env } from '../../config/env';

export function createJiraClient() {
  return new Version3Client({
    host: env.JIRA_HOST,
    authentication: {
      basic: {
        email: env.JIRA_EMAIL,
        apiToken: env.JIRA_API_TOKEN
      }
    }
  });
}
