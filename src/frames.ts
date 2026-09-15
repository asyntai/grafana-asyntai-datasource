import { DataFrame, FieldType, createDataFrame } from '@grafana/data';

import { ApiLead, ApiMessage, ApiSession, ApiTicket, GroupBy } from './types';

/** One record reduced to what a chart needs: when it happened and its group. */
interface Point {
  at: number;
  group: string;
}

const NO_GROUP = 'Count';
const UNKNOWN = 'Unknown';

/**
 * Machine values that read badly in a legend or a table cell.
 *
 * Countries, categories and website names are already written for people, so
 * they pass through as they are.
 */
const NAMES: Record<string, string> = {
  widget: 'Website widget',
  api: 'API',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  gorgias: 'Gorgias',
  freshchat: 'Freshchat',
  zapier: 'Zapier',
  session: 'Chat',
  email: 'Email',
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

function label(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (text === '') {
    return UNKNOWN;
  }
  return NAMES[text.toLowerCase()] ?? text;
}

/**
 * Count the records per time bucket, one series per group.
 *
 * Empty buckets are written as zero, so a quiet night draws a flat line
 * instead of a gap.
 */
export function toTimeSeries(
  points: Point[],
  from: number,
  to: number,
  intervalMs: number,
  refId: string,
  title: string
): DataFrame[] {
  const step = Math.max(intervalMs, 1000);
  const start = Math.floor(from / step) * step;
  const buckets: number[] = [];
  for (let at = start; at <= to; at += step) {
    buckets.push(at);
  }

  const groups = new Map<string, Map<number, number>>();
  for (const point of points) {
    if (point.at < from || point.at > to) {
      continue;
    }
    const bucket = Math.floor(point.at / step) * step;
    let counts = groups.get(point.group);
    if (!counts) {
      counts = new Map<number, number>();
      groups.set(point.group, counts);
    }
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  // A panel with no records still needs one empty series, or Grafana shows
  // an empty panel with no axis at all.
  if (groups.size === 0) {
    groups.set(NO_GROUP, new Map<number, number>());
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, counts]) =>
      createDataFrame({
        refId,
        fields: [
          { name: 'time', type: FieldType.time, values: buckets },
          {
            // The series name lives on the value field alone. Naming the frame
            // as well makes Grafana print the name twice in the legend.
            name: group === NO_GROUP ? title : group,
            type: FieldType.number,
            values: buckets.map((bucket) => counts.get(bucket) ?? 0),
          },
        ],
      })
    );
}

function sessionGroup(row: ApiSession, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'source':
      return label(row.source);
    case 'country':
      return label(row.country);
    case 'category':
      return label(row.category);
    case 'website':
      return label(row.website_domain);
    default:
      return NO_GROUP;
  }
}

function ticketGroup(row: ApiTicket, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'status':
      return label(row.status);
    case 'priority':
      return label(row.priority);
    case 'source':
      return label(row.channel);
    default:
      return NO_GROUP;
  }
}

export function sessionPoints(rows: ApiSession[], groupBy: GroupBy): Point[] {
  return rows
    .filter((row) => row.first_message_at)
    .map((row) => ({ at: Date.parse(row.first_message_at as string), group: sessionGroup(row, groupBy) }));
}

export function leadPoints(rows: ApiLead[]): Point[] {
  return rows
    .filter((row) => row.started_at)
    .map((row) => ({ at: Date.parse(row.started_at as string), group: NO_GROUP }));
}

export function ticketPoints(rows: ApiTicket[], groupBy: GroupBy): Point[] {
  return rows
    .filter((row) => row.created_at)
    .map((row) => ({ at: Date.parse(row.created_at as string), group: ticketGroup(row, groupBy) }));
}

function times(values: Array<string | null>): Array<number | null> {
  return values.map((value) => (value ? Date.parse(value) : null));
}

/** Column width for the table panel. The widest text column gets none. */
function wide(width: number) {
  return { custom: { width } };
}

export function sessionTable(rows: ApiSession[], refId: string): DataFrame {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Started', type: FieldType.time, config: wide(170), values: times(rows.map((row) => row.first_message_at)) },
      { name: 'First question', type: FieldType.string, values: rows.map((row) => row.first_message ?? '') },
      { name: 'Messages', type: FieldType.number, config: wide(100), values: rows.map((row) => row.message_count) },
      { name: 'Source', type: FieldType.string, config: wide(140), values: rows.map((row) => label(row.source)) },
      { name: 'Country', type: FieldType.string, config: wide(140), values: rows.map((row) => label(row.country)) },
      { name: 'Category', type: FieldType.string, config: wide(140), values: rows.map((row) => row.category ?? '') },
      { name: 'Website', type: FieldType.string, config: wide(160), values: rows.map((row) => row.website_domain) },
      { name: 'Page', type: FieldType.string, values: rows.map((row) => row.page_url ?? '') },
      {
        name: 'First reply',
        type: FieldType.number,
        // Grafana turns milliseconds into "1.79 s" on its own.
        config: { unit: 'ms', custom: { width: 120 } },
        values: rows.map((row) => row.first_response_time_ms ?? null),
      },
      { name: 'Handed to a person', type: FieldType.time, config: wide(170), values: times(rows.map((row) => row.taken_over_at)) },
      { name: 'Session', type: FieldType.string, config: wide(180), values: rows.map((row) => row.session_id) },
    ],
  });
}

export function leadTable(rows: ApiLead[], refId: string): DataFrame {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Captured', type: FieldType.time, config: wide(180), values: times(rows.map((row) => row.started_at)) },
      { name: 'Email', type: FieldType.string, values: rows.map((row) => row.email ?? '') },
      { name: 'Phone', type: FieldType.string, config: wide(160), values: rows.map((row) => row.phone ?? '') },
      { name: 'Page', type: FieldType.string, values: rows.map((row) => row.page_url ?? '') },
      { name: 'Session', type: FieldType.string, config: wide(180), values: rows.map((row) => row.session_id) },
    ],
  });
}

export function ticketTable(rows: ApiTicket[], refId: string): DataFrame {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Created', type: FieldType.time, values: times(rows.map((row) => row.created_at)) },
      { name: 'Ticket', type: FieldType.string, values: rows.map((row) => row.ticket_number) },
      { name: 'Subject', type: FieldType.string, values: rows.map((row) => row.subject) },
      { name: 'Status', type: FieldType.string, values: rows.map((row) => label(row.status)) },
      { name: 'Priority', type: FieldType.string, values: rows.map((row) => label(row.priority)) },
      { name: 'Channel', type: FieldType.string, values: rows.map((row) => label(row.channel)) },
      { name: 'Visitor', type: FieldType.string, values: rows.map((row) => row.visitor_email ?? '') },
      { name: 'Assigned to', type: FieldType.string, values: rows.map((row) => row.assigned_to ?? '') },
      { name: 'First reply', type: FieldType.time, values: times(rows.map((row) => row.first_response_at)) },
      { name: 'Resolved', type: FieldType.time, values: times(rows.map((row) => row.resolved_at)) },
      { name: 'Session', type: FieldType.string, config: wide(180), values: rows.map((row) => row.session_id ?? '') },
    ],
  });
}

export function messageTable(rows: ApiMessage[], refId: string): DataFrame {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, config: wide(190), values: times(rows.map((row) => row.timestamp)) },
      {
        name: 'Who',
        type: FieldType.string,
        config: wide(150),
        values: rows.map((row) => {
          if (row.role === 'user') {
            return 'Visitor';
          }
          return row.sender_type === 'human' ? row.agent_name || 'Agent' : 'Assistant';
        }),
      },
      { name: 'Message', type: FieldType.string, values: rows.map((row) => row.content) },
      {
        name: 'Reply time',
        type: FieldType.number,
        config: { unit: 'ms', custom: { width: 140 } },
        values: rows.map((row) => row.response_time_ms ?? null),
      },
    ],
  });
}
