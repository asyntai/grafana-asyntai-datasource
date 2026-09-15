import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

/** What the panel asks Asyntai for. */
export type Resource = 'sessions' | 'leads' | 'tickets' | 'messages';

/** Table gives one row per record, time series gives a count per time bucket. */
export type Format = 'table' | 'timeseries';

/** Extra series split for the time series format. */
export type GroupBy = 'none' | 'source' | 'country' | 'category' | 'website' | 'status' | 'priority';

export interface AsyntaiQuery extends DataQuery {
  resource: Resource;
  format: Format;
  groupBy: GroupBy;
  /** Only chats and leads of this website. Empty means every website. */
  websiteId?: string;
  /** Only chats that arrived this way, e.g. widget or whatsapp. */
  source?: string;
  /** Only tickets in this state, e.g. open or resolved. */
  status?: string;
  /** The chat to read the messages of. Only used by the messages resource. */
  sessionId?: string;
  /** Row cap for the table format. */
  limit?: number;
}

export const DEFAULT_QUERY: Partial<AsyntaiQuery> = {
  resource: 'sessions',
  format: 'timeseries',
  groupBy: 'none',
  limit: 100,
};

export interface AsyntaiOptions extends DataSourceJsonData {}

/** Never leaves the Grafana server. */
export interface AsyntaiSecureJsonData {
  apiKey?: string;
}

/* ---------- What the Asyntai API answers ---------- */

export interface ApiSession {
  session_id: string;
  source: string;
  message_count: number;
  first_message: string | null;
  first_message_at: string | null;
  last_message_at: string | null;
  first_response_time_ms: number | null;
  first_human_response_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  taken_over_at: string | null;
  page_url: string | null;
  country: string | null;
  website_domain: string;
  category: string;
}

export interface ApiLead {
  session_id: string;
  email: string | null;
  phone: string | null;
  page_url: string | null;
  started_at: string | null;
}

export interface ApiTicket {
  ticket_number: string;
  session_id: string | null;
  status: string;
  priority: string;
  subject: string;
  visitor_email: string | null;
  page_url: string | null;
  website_id: number;
  channel: string;
  assigned_to: string | null;
  created_at: string | null;
  first_assigned_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
}

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sender_type?: string;
  agent_name?: string | null;
  response_time_ms?: number | null;
}
