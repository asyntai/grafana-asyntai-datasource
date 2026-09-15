import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { ApiLead, ApiMessage, ApiSession, ApiTicket } from './types';

/** The API answers at most this many rows in one call. */
const PAGE_SIZE = 100;

/** Stop after this many calls, so one panel can never hammer the API. */
const MAX_PAGES = 50;

export class AsyntaiApi {
  constructor(private readonly proxyUrl: string) {}

  private async get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        search.set(key, String(value));
      }
    }
    const query = search.toString();
    const response = await lastValueFrom(
      getBackendSrv().fetch<T>({
        url: `${this.proxyUrl}/asyntai/api/v1/${path}/${query ? `?${query}` : ''}`,
        method: 'GET',
        showErrorAlert: false,
      })
    );
    return response.data;
  }

  /**
   * Walk back through history until `since` is reached.
   *
   * The list endpoints answer newest first and cap a page at 100 rows, so the
   * oldest timestamp of one page becomes the `before` of the next one. That
   * pages backward with no gaps and no repeats.
   *
   * An endpoint that does not know `before` yet answers the same newest page
   * every time. The seen-id set catches that: the second page adds nothing
   * new, so the walk stops with one page of rows instead of many copies.
   */
  private async pageBackwards<T>(
    path: string,
    key: string,
    idOf: (row: T) => string,
    timeOf: (row: T) => string | null,
    since: string,
    until: string,
    params: Record<string, string | number | undefined>
  ): Promise<T[]> {
    const rows: T[] = [];
    const seen = new Set<string>();
    let before: string | undefined = until;

    for (let page = 0; page < MAX_PAGES; page++) {
      const payload = await this.get<Record<string, T[]>>(path, {
        ...params,
        limit: PAGE_SIZE,
        since,
        before,
      });
      const batch = payload[key] ?? [];

      let added = 0;
      for (const row of batch) {
        const id = idOf(row);
        if (!seen.has(id)) {
          seen.add(id);
          rows.push(row);
          added++;
        }
      }

      // A short page is the last page. A page with nothing new means the
      // server ignored `before`, so walking further would only repeat rows.
      if (batch.length < PAGE_SIZE || added === 0) {
        break;
      }

      // The API sorts newest first, so the last row of the page is the oldest.
      const oldest = timeOf(batch[batch.length - 1]);
      if (!oldest || oldest === before) {
        break;
      }
      before = oldest;
    }

    return rows;
  }

  async sessions(since: string, until: string, filters: Record<string, string | undefined>): Promise<ApiSession[]> {
    return this.pageBackwards<ApiSession>(
      'sessions',
      'sessions',
      (row) => row.session_id,
      (row) => row.last_message_at,
      since,
      until,
      { website_id: filters.websiteId, source: filters.source }
    );
  }

  async tickets(since: string, until: string, filters: Record<string, string | undefined>): Promise<ApiTicket[]> {
    return this.pageBackwards<ApiTicket>(
      'tickets',
      'tickets',
      (row) => row.ticket_number,
      (row) => row.created_at,
      since,
      until,
      { website_id: filters.websiteId, status: filters.status }
    );
  }

  /**
   * Leads come newest first. The endpoint has no date window yet, so older
   * servers answer the newest page and ignore `since` and `before`; the rows
   * are cut to the panel's time range afterwards either way.
   */
  async leads(since: string, until: string, filters: Record<string, string | undefined>): Promise<ApiLead[]> {
    const rows = await this.pageBackwards<ApiLead>(
      'leads',
      'leads',
      (row) => `${row.session_id}:${row.started_at}`,
      (row) => row.started_at,
      since,
      until,
      { website_id: filters.websiteId }
    );
    const from = Date.parse(since);
    const to = Date.parse(until);
    return rows.filter((row) => {
      if (!row.started_at) {
        return false;
      }
      const at = Date.parse(row.started_at);
      return at >= from && at < to;
    });
  }

  async messages(sessionId: string): Promise<ApiMessage[]> {
    const payload = await this.get<{ messages: ApiMessage[] }>('conversations', {
      session_id: sessionId,
      limit: PAGE_SIZE,
    });
    return payload.messages ?? [];
  }

  /** Used by the Save & test button. */
  async account(): Promise<{ success: boolean }> {
    return this.get<{ success: boolean }>('account', {});
  }
}
