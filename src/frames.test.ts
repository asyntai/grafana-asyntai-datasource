import { ApiLead, ApiSession, ApiTicket } from './types';
import { leadPoints, leadTable, sessionPoints, sessionTable, ticketPoints, toTimeSeries } from './frames';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function session(at: string, extra: Partial<ApiSession> = {}): ApiSession {
  return {
    session_id: `session_${at}`,
    source: 'widget',
    message_count: 3,
    first_message: 'Do you ship to Germany?',
    first_message_at: at,
    last_message_at: at,
    first_response_time_ms: 900,
    first_human_response_at: null,
    started_at: at,
    ended_at: null,
    taken_over_at: null,
    page_url: 'https://example.com/pricing',
    country: 'Germany',
    website_domain: 'example.com',
    category: 'Shipping',
    ...extra,
  };
}

describe('toTimeSeries', () => {
  const from = Date.parse('2026-09-01T00:00:00Z');
  const to = from + 3 * DAY;

  it('counts one record into its own day', () => {
    const points = sessionPoints([session('2026-09-02T09:00:00Z')], 'none');
    const frames = toTimeSeries(points, from, to, DAY, 'A', 'Chats');

    expect(frames).toHaveLength(1);
    expect(frames[0].fields[1].name).toBe('Chats');
    const values = frames[0].fields[1].values as number[];
    expect(values).toEqual([0, 1, 0, 0]);
  });

  it('writes a zero for a day with no chats', () => {
    const frames = toTimeSeries([], from, to, DAY, 'A', 'Chats');
    const values = frames[0].fields[1].values as number[];
    expect(values.every((value) => value === 0)).toBe(true);
    expect(frames[0].fields[0].values).toHaveLength(4);
  });

  it('makes one series per group', () => {
    const rows = [
      session('2026-09-02T09:00:00Z', { country: 'Germany' }),
      session('2026-09-02T10:00:00Z', { country: 'France' }),
      session('2026-09-03T10:00:00Z', { country: 'France' }),
    ];
    const frames = toTimeSeries(sessionPoints(rows, 'country'), from, to, DAY, 'A', 'Chats');

    expect(frames.map((frame) => frame.fields[1].name)).toEqual(['France', 'Germany']);
    expect(frames[0].fields[1].values).toEqual([0, 1, 1, 0]);
    expect(frames[1].fields[1].values).toEqual([0, 1, 0, 0]);
  });

  it('calls an empty group Unknown', () => {
    const frames = toTimeSeries(
      sessionPoints([session('2026-09-02T09:00:00Z', { country: '' })], 'country'),
      from,
      to,
      DAY,
      'A',
      'Chats'
    );
    expect(frames[0].fields[1].name).toBe('Unknown');
  });

  it('drops a record outside the time range', () => {
    const points = sessionPoints([session('2026-08-20T09:00:00Z')], 'none');
    const frames = toTimeSeries(points, from, to, DAY, 'A', 'Chats');
    expect((frames[0].fields[1].values as number[]).every((value) => value === 0)).toBe(true);
  });
});

describe('tables', () => {
  it('keeps every chat column', () => {
    const frame = sessionTable([session('2026-09-02T09:00:00Z')], 'A');
    expect(frame.fields.map((field) => field.name)).toEqual([
      'Started',
      'First question',
      'Messages',
      'Source',
      'Country',
      'Category',
      'Website',
      'Page',
      'First reply',
      'Handed to a person',
      'Session',
    ]);
    expect(frame.fields[0].values[0]).toBe(Date.parse('2026-09-02T09:00:00Z'));
    // A chat nobody took over leaves an empty cell, never the text NaN.
    expect(frame.fields[9].values[0]).toBeNull();
  });

  it('writes an empty string where a lead has no phone number', () => {
    const lead: ApiLead = {
      session_id: 'session_1',
      email: 'visitor@example.com',
      phone: null,
      page_url: null,
      started_at: '2026-09-02T09:00:00Z',
    };
    const frame = leadTable([lead], 'A');
    expect(frame.fields[2].values[0]).toBe('');
    expect(frame.fields[3].values[0]).toBe('');
    expect(frame.fields[1].values[0]).toBe('visitor@example.com');
  });
});

describe('points', () => {
  it('skips a lead with no time', () => {
    const rows: ApiLead[] = [
      { session_id: 'a', email: 'a@example.com', phone: null, page_url: null, started_at: null },
      { session_id: 'b', email: 'b@example.com', phone: null, page_url: null, started_at: '2026-09-02T09:00:00Z' },
    ];
    expect(leadPoints(rows)).toHaveLength(1);
  });

  it('writes a machine value as a name a person reads', () => {
    const rows = [
      session('2026-09-02T09:00:00Z', { source: 'widget' }),
      session('2026-09-02T10:00:00Z', { source: 'whatsapp' }),
    ];
    expect(sessionPoints(rows, 'source').map((point) => point.group)).toEqual(['Website widget', 'WhatsApp']);
  });

  it('groups tickets by status', () => {
    const ticket: ApiTicket = {
      ticket_number: 'TKT-1',
      session_id: 'session_1',
      status: 'open',
      priority: 'high',
      subject: 'Cannot pay',
      visitor_email: null,
      page_url: null,
      website_id: 1,
      channel: 'session',
      assigned_to: null,
      created_at: '2026-09-02T09:00:00Z',
      first_assigned_at: null,
      first_response_at: null,
      resolved_at: null,
    };
    expect(ticketPoints([ticket], 'status')[0].group).toBe('Open');
    expect(ticketPoints([ticket], 'priority')[0].group).toBe('High');
    expect(ticketPoints([ticket], 'none')[0].group).toBe('Count');
  });
});
