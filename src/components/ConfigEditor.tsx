import React, { ChangeEvent } from 'react';
import { InlineField, SecretInput } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';

import { AsyntaiOptions, AsyntaiSecureJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<AsyntaiOptions, AsyntaiSecureJsonData> {}

export function ConfigEditor({ options, onOptionsChange }: Props) {
  const { secureJsonFields, secureJsonData } = options;

  // The key is stored by the Grafana server and is never read back into the browser.
  const onApiKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: { apiKey: event.target.value },
    });
  };

  const onResetApiKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: { ...secureJsonFields, apiKey: false },
      secureJsonData: { ...secureJsonData, apiKey: '' },
    });
  };

  return (
    <InlineField
      label="API key"
      labelWidth={20}
      interactive
      tooltip="Asyntai dashboard, Settings, then API. The key needs the Starter plan or higher."
    >
      <SecretInput
        required
        id="asyntai-api-key"
        isConfigured={!!secureJsonFields.apiKey}
        value={secureJsonData?.apiKey ?? ''}
        placeholder="Paste your Asyntai API key"
        width={40}
        onReset={onResetApiKey}
        onChange={onApiKeyChange}
      />
    </InlineField>
  );
}
