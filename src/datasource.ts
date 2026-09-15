import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  ScopedVars,
  TestDataSourceResponse,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { AsyntaiApi } from './api';
import {
  leadPoints,
  leadTable,
  messageTable,
  sessionPoints,
  sessionTable,
  ticketPoints,
  ticketTable,
  toTimeSeries,
} from './frames';
import { AsyntaiOptions, AsyntaiQuery, DEFAULT_QUERY } from './types';

/** Shown as the series name when the query has no group. */
const TITLES: Record<string, string> = {
  sessions: 'Chats',
  leads: 'Leads',
  tickets: 'Tickets',
  messages: 'Messages',
};

export class DataSource extends DataSourceApi<AsyntaiQuery, AsyntaiOptions> {
  private readonly api: AsyntaiApi;

  constructor(instanceSettings: DataSourceInstanceSettings<AsyntaiOptions>) {
    super(instanceSettings);
    this.api = new AsyntaiApi(instanceSettings.url ?? '');
  }

  getDefaultQuery(_app: CoreApp): Partial<AsyntaiQuery> {
    return DEFAULT_QUERY;
  }

  applyTemplateVariables(query: AsyntaiQuery, scopedVars: ScopedVars): AsyntaiQuery {
    const srv = getTemplateSrv();
    return {
      ...query,
      websiteId: srv.replace(query.websiteId, scopedVars),
      source: srv.replace(query.source, scopedVars),
      status: srv.replace(query.status, scopedVars),
      sessionId: srv.replace(query.sessionId, scopedVars),
    };
  }

  filterQuery(query: AsyntaiQuery): boolean {
    if (query.hide) {
      return false;
    }
    // Messages belong to one chat, so without a session there is nothing to ask for.
    if (query.resource === 'messages') {
      return !!query.sessionId;
    }
    return true;
  }

  async query(request: DataQueryRequest<AsyntaiQuery>): Promise<DataQueryResponse> {
    const since = request.range.from.toISOString();
    const until = request.range.to.toISOString();
    const from = request.range.from.valueOf();
    const to = request.range.to.valueOf();

    try {
      const results = await Promise.all(
        request.targets
          .filter((target) => this.filterQuery(target))
          .map((target) => this.runOne(target, since, until, from, to, request.intervalMs))
      );
      return { data: results.flat() };
    } catch (error) {
      throw new Error(describe(error));
    }
  }

  private async runOne(
    query: AsyntaiQuery,
    since: string,
    until: string,
    from: number,
    to: number,
    intervalMs: number
  ) {
    const refId = query.refId;
    const format = query.format ?? 'timeseries';
    const groupBy = query.groupBy ?? 'none';
    const title = TITLES[query.resource] ?? 'Count';
    const limit = Math.max(1, query.limit ?? 100);
    const filters = { websiteId: query.websiteId, source: query.source, status: query.status };

    switch (query.resource) {
      case 'leads': {
        const rows = await this.api.leads(since, until, filters);
        return format === 'table'
          ? [leadTable(rows.slice(0, limit), refId)]
          : toTimeSeries(leadPoints(rows), from, to, intervalMs, refId, title);
      }
      case 'tickets': {
        const rows = await this.api.tickets(since, until, filters);
        return format === 'table'
          ? [ticketTable(rows.slice(0, limit), refId)]
          : toTimeSeries(ticketPoints(rows, groupBy), from, to, intervalMs, refId, title);
      }
      case 'messages': {
        const rows = await this.api.messages(query.sessionId ?? '');
        return [messageTable(rows, refId)];
      }
      case 'sessions':
      default: {
        const rows = await this.api.sessions(since, until, filters);
        return format === 'table'
          ? [sessionTable(rows.slice(0, limit), refId)]
          : toTimeSeries(sessionPoints(rows, groupBy), from, to, intervalMs, refId, title);
      }
    }
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    try {
      const account = await this.api.account();
      if (account?.success) {
        return { status: 'success', message: 'Connected to Asyntai.' };
      }
      return { status: 'error', message: 'Asyntai answered, but not with an account. Check the API key.' };
    } catch (error) {
      return { status: 'error', message: describe(error) };
    }
  }
}

/**
 * Turn a failed call into one sentence the user can act on.
 *
 * The Grafana proxy answers 400 when Asyntai answers 401, and it does not
 * always hand the body of that answer to the plugin. So a plain 400 with no
 * body means the key, and a body that carries a sentence from Asyntai wins
 * over any guess from the status.
 */
export function describe(error: unknown): string {
  const failure = error as { status?: number; statusText?: string; message?: string; data?: unknown };
  const body = readBody(failure?.data);
  const proxyAuth = /Authentication to data source failed/i.test(body);

  if (body && !proxyAuth) {
    return body;
  }
  if (proxyAuth || failure?.status === 400 || failure?.status === 401) {
    return 'Asyntai refused the API key. Copy it again from the Asyntai dashboard, under Settings, then API.';
  }
  if (failure?.status === 403) {
    return 'The Asyntai API needs the Starter plan or higher.';
  }
  return failure?.statusText || failure?.message || 'Could not reach Asyntai.';
}

/**
 * Read the message out of a JSON body, a JSON string, or plain text.
 *
 * Order matters. When the Grafana proxy refuses a call it writes its own word
 * "Bad Request" into `error` and puts the sentence that explains the failure
 * into `response` and `message`, so `error` has to be read last.
 */
function readBody(data: unknown): string {
  if (typeof data === 'string') {
    try {
      return pick(JSON.parse(data)) || data;
    } catch {
      return data;
    }
  }
  return pick(data);
}

function pick(data: unknown): string {
  if (data && typeof data === 'object') {
    const body = data as { response?: unknown; message?: unknown; error?: unknown };
    for (const found of [body.response, body.message, body.error]) {
      if (typeof found === 'string' && found.trim() !== '') {
        return found;
      }
    }
  }
  return '';
}
