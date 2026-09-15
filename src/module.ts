import { DataSourcePlugin } from '@grafana/data';

import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { AsyntaiOptions, AsyntaiQuery } from './types';

export const plugin = new DataSourcePlugin<DataSource, AsyntaiQuery, AsyntaiOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
