import { createJiraClient } from '../modules/jira/jira-client';
import { JiraService } from '../modules/jira/jira-service';
import { IngestionService } from '../modules/ingestion/ingestion-service';

export async function runSyncJiraJob() {
  const jiraClient = createJiraClient();
  const jiraService = new JiraService(jiraClient);
  const ingestionService = new IngestionService(jiraService);

  return ingestionService.runInitialSync();
}
