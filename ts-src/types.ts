export interface HireData {
  role: string;
  salary: string;
  equity: string;
  startDate: string;
  slackHandle?: string;
}

export interface SlackMessage {
  text: string;
  ts: string;
  thread_ts?: string;
}

export interface SlackSay {
  (message: string | { text: string; blocks?: any[] }): Promise<any>;
} 