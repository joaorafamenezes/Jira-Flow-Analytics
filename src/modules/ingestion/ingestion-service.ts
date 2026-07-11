import { env } from '../../config/env';
import type { JiraService } from '../jira/jira-service';

export class IngestionService {
  constructor(private readonly jiraService: JiraService) {}

  async runInitialSync() {
    const issues = await this.jiraService.getRecentIssues(env.JIRA_DEFAULT_JQL, 50);

    return {
      syncType: 'initial',
      projectKey: env.JIRA_PROJECT_KEY,
      fetchedAt: new Date().toISOString(),
      issueCount: issues.length,
      issues
    };
  }
}
