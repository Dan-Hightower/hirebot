export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: {
    type: string;
    text: string;
  }[];
  elements?: SlackBlockElement[];
}

export interface SlackBlockElement {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  style?: string;
  action_id?: string;
  value?: string;
}

export interface SlackMessage {
  text: string;
  ts: string;
  thread_ts?: string;
  user: string;
}

export interface SlackMessageOptions {
  text: string;
  blocks?: SlackBlock[];
  thread_ts?: string;
}

export interface SlackSay {
  (message: string | SlackMessageOptions): Promise<any>;
} 