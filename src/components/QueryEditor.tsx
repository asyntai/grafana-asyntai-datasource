import React, { ChangeEvent } from 'react';
import { Combobox, ComboboxOption, InlineField, Input, Stack } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';

import { DataSource } from '../datasource';
import { AsyntaiOptions, AsyntaiQuery, Format, GroupBy, Resource } from '../types';

type Props = QueryEditorProps<DataSource, AsyntaiQuery, AsyntaiOptions>;

const RESOURCES: Array<ComboboxOption<Resource>> = [
  { label: 'Chats', value: 'sessions', description: 'One record per conversation' },
  { label: 'Leads', value: 'leads', description: 'Visitors who left an email address or a phone number' },
  { label: 'Tickets', value: 'tickets', description: 'Support tickets raised from a chat' },
  { label: 'Messages of one chat', value: 'messages', description: 'The whole conversation, message by message' },
];

const FORMATS: Array<ComboboxOption<Format>> = [
  { label: 'Time series', value: 'timeseries', description: 'A count per time bucket, for a graph' },
  { label: 'Table', value: 'table', description: 'One row per record' },
];

/** Each resource can only be split by the fields it carries. */
const GROUPS: Record<Resource, Array<ComboboxOption<GroupBy>>> = {
  sessions: [
    { label: 'Nothing', value: 'none' },
    { label: 'Source', value: 'source' },
    { label: 'Country', value: 'country' },
    { label: 'Category', value: 'category' },
    { label: 'Website', value: 'website' },
  ],
  tickets: [
    { label: 'Nothing', value: 'none' },
    { label: 'Status', value: 'status' },
    { label: 'Priority', value: 'priority' },
    { label: 'Channel', value: 'source' },
  ],
  leads: [{ label: 'Nothing', value: 'none' }],
  messages: [{ label: 'Nothing', value: 'none' }],
};

const SOURCES: Array<ComboboxOption<string>> = [
  { label: 'Every source', value: '' },
  { label: 'Website widget', value: 'widget' },
  { label: 'API', value: 'api' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Messenger', value: 'messenger' },
  { label: 'Gorgias', value: 'gorgias' },
  { label: 'Freshchat', value: 'freshchat' },
  { label: 'Zapier', value: 'zapier' },
];

const STATUSES: Array<ComboboxOption<string>> = [
  { label: 'Every status', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const resource: Resource = query.resource ?? 'sessions';
  const format: Format = query.format ?? 'timeseries';
  const groupBy: GroupBy = query.groupBy ?? 'none';

  const update = (patch: Partial<AsyntaiQuery>) => {
    onChange({ ...query, ...patch });
    onRunQuery();
  };

  const onResourceChange = (item: ComboboxOption<Resource> | null) => {
    const next = item?.value ?? 'sessions';
    // The old split may not exist on the new resource, so start it clean.
    update({ resource: next, groupBy: 'none' });
  };

  const isMessages = resource === 'messages';
  const isTable = format === 'table' || isMessages;

  return (
    <Stack direction="column" gap={0}>
      <Stack gap={0}>
        <InlineField label="Show" labelWidth={16}>
          <Combobox options={RESOURCES} value={resource} onChange={onResourceChange} width={32} />
        </InlineField>
        {!isMessages && (
          <InlineField label="As" labelWidth={10}>
            <Combobox
              options={FORMATS}
              value={format}
              onChange={(item: ComboboxOption<Format> | null) => update({ format: item?.value ?? 'timeseries' })}
              width={24}
            />
          </InlineField>
        )}
        {!isMessages && format === 'timeseries' && (
          <InlineField label="Split by" labelWidth={12}>
            <Combobox
              options={GROUPS[resource]}
              value={groupBy}
              onChange={(item: ComboboxOption<GroupBy> | null) => update({ groupBy: item?.value ?? 'none' })}
              width={20}
            />
          </InlineField>
        )}
      </Stack>

      <Stack gap={0}>
        {isMessages && (
          <InlineField label="Chat" labelWidth={16} tooltip="The session id, for example session_abc123.">
            <Input
              id="asyntai-session-id"
              value={query.sessionId ?? ''}
              placeholder="session_abc123"
              onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...query, sessionId: event.target.value })}
              onBlur={onRunQuery}
              width={32}
            />
          </InlineField>
        )}
        {!isMessages && (
          <InlineField label="Website" labelWidth={16} tooltip="The Asyntai website id. Leave it empty for every website.">
            <Input
              id="asyntai-website-id"
              value={query.websiteId ?? ''}
              placeholder="Every website"
              onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...query, websiteId: event.target.value })}
              onBlur={onRunQuery}
              width={24}
            />
          </InlineField>
        )}
        {resource === 'sessions' && (
          <InlineField label="Source" labelWidth={12}>
            <Combobox
              options={SOURCES}
              value={query.source ?? ''}
              onChange={(item: ComboboxOption<string> | null) => update({ source: item?.value ?? '' })}
              width={24}
            />
          </InlineField>
        )}
        {resource === 'tickets' && (
          <InlineField label="Status" labelWidth={12}>
            <Combobox
              options={STATUSES}
              value={query.status ?? ''}
              onChange={(item: ComboboxOption<string> | null) => update({ status: item?.value ?? '' })}
              width={24}
            />
          </InlineField>
        )}
        {isTable && !isMessages && (
          <InlineField label="Rows" labelWidth={10} tooltip="How many records the table shows, newest first.">
            <Input
              id="asyntai-limit"
              type="number"
              value={query.limit ?? 100}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onChange({ ...query, limit: parseInt(event.target.value, 10) || 100 })
              }
              onBlur={onRunQuery}
              width={14}
            />
          </InlineField>
        )}
      </Stack>
    </Stack>
  );
}
