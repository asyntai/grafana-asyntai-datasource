import { describe as explain } from './datasource';

const KEY_MESSAGE = 'Asyntai refused the API key. Copy it again from the Asyntai dashboard, under Settings, then API.';

describe('explain', () => {
  it('names the key when the Grafana proxy hides the body', () => {
    // Grafana answers 400 with no body for a refused key, so the status alone
    // has to carry the meaning.
    expect(explain({ status: 400, statusText: 'Bad Request' })).toBe(KEY_MESSAGE);
  });

  it('names the key when the proxy does hand over its own text', () => {
    expect(explain({ status: 400, data: 'Authentication to data source failed' })).toBe(KEY_MESSAGE);
  });

  it('ignores the word Bad Request that the proxy writes into the error field', () => {
    // This is the exact body Grafana 13 hands over for a refused key.
    const real = {
      status: 400,
      statusText: 'Bad Request',
      data: {
        message: 'Authentication to data source failed',
        error: 'Bad Request',
        response: 'Authentication to data source failed',
      },
    };
    expect(explain(real)).toBe(KEY_MESSAGE);
  });

  it('names the key on a plain 401', () => {
    expect(explain({ status: 401, data: { error: 'Invalid API key' } })).toBe('Invalid API key');
  });

  it('repeats the sentence Asyntai sent', () => {
    const sentence = 'API access requires a paid plan (Starter, Standard, or Pro).';
    expect(explain({ status: 403, data: { error: sentence } })).toBe(sentence);
  });

  it('falls back to the plan sentence when a 403 carries no body', () => {
    expect(explain({ status: 403 })).toBe('The Asyntai API needs the Starter plan or higher.');
  });

  it('reads a JSON body that arrived as text', () => {
    expect(explain({ status: 500, data: '{"error": "Something broke"}' })).toBe('Something broke');
  });

  it('says something useful when nothing else is known', () => {
    expect(explain({})).toBe('Could not reach Asyntai.');
  });
});
