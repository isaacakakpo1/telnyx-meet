import type { H3Event } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import clientTokenHandler from '../../server/api/client_token.post';
import dialOutHandler from '../../server/api/dial_out.post';
import refreshClientTokenHandler from '../../server/api/refresh_client_token.post';
import {
  TOKEN_DIAL_API_MESSAGES,
  resolveTelnyxUpstreamConfig,
} from '../../server/utils/telnyx-upstream';

const API_KEY = 'test-telnyx-secret-key';
const API_HOST = 'https://api.example.test/v2';
const CALL_CONTROL_HOST = 'https://call-control.example.test/v2';
const ROOM_ID = '123e4567-e89b-12d3-a456-426614174000';
const REFRESH_TOKEN = 'test-refresh-token';
const PHONE_NUMBER = '+15551234567';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type HeaderValue = string | number | readonly string[];

type MockResponse = {
  statusCode: number;
  statusMessage: string;
  setHeader: (name: string, value: HeaderValue) => MockResponse;
  getHeader: (name: string) => HeaderValue | undefined;
  removeHeader: (name: string) => void;
  end: () => MockResponse;
};

type MockEvent = {
  event: H3Event;
  headers: Record<string, HeaderValue>;
  response: MockResponse;
};

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

let fetchMock: ReturnType<
  typeof vi.fn<(input: FetchInput, init?: FetchInit) => Promise<Response>>
>;

const createEvent = (method: string, body?: unknown): MockEvent => {
  const headers: Record<string, HeaderValue> = {};
  const response: MockResponse = {
    statusCode: 200,
    statusMessage: '',
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;

      return response;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    removeHeader(name) {
      delete headers[name.toLowerCase()];
    },
    end() {
      return response;
    },
  };

  const req = {
    method,
    url: '/api/token',
    headers: { 'content-type': 'application/json' },
  };
  const event = {
    method,
    _requestBody: body,
    context: { params: {} },
    node: { req, res: response },
  } as unknown as H3Event;

  return { event, headers, response };
};

const upstreamResponse = (
  body: unknown,
  status = 200,
  statusText = status >= 200 && status < 300 ? 'OK' : 'Upstream Error'
): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

const outboundRequest = (callIndex = 0) => {
  const [url, init] = fetchMock.mock.calls[callIndex] ?? [];
  const headers = (init?.headers ?? {}) as Record<string, string>;
  const body =
    typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;

  return { url: String(url), headers, init, body };
};

beforeEach(() => {
  vi.stubEnv('TELNYX_API_KEY', API_KEY);
  vi.stubEnv('TELNYX_API_HOST', API_HOST);
  vi.stubEnv('TELNYX_CALL_CONTROL_API_HOST', CALL_CONTROL_HOST);

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/client_token', () => {
  it('generates a join token and forwards the Telnyx credentials', async () => {
    const tokenData = {
      token: 'client-token-value',
      refresh_token: 'refresh-token-value',
    };
    fetchMock.mockResolvedValue(upstreamResponse({ data: tokenData }));

    const { event, response } = createEvent('POST', { room_id: ROOM_ID });
    const result = await clientTokenHandler(event);

    expect(response.statusCode).toBe(200);
    expect(result).toEqual(tokenData);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { url, headers, init, body } = outboundRequest();
    expect(url).toBe(
      `${API_HOST}/rooms/${ROOM_ID}/actions/generate_join_client_token`
    );
    expect(init?.method).toBe('POST');
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.request_id).toMatch(UUID_PATTERN);
    expect(body).toEqual({
      refresh_token_ttl_secs: 3600,
      token_ttl_secs: 60,
    });
  });

  it('uses a fresh request id for every upstream call', async () => {
    fetchMock.mockResolvedValue(upstreamResponse({ data: {} }));

    await clientTokenHandler(createEvent('POST', { room_id: ROOM_ID }).event);
    await clientTokenHandler(createEvent('POST', { room_id: ROOM_ID }).event);

    expect(outboundRequest(0).headers.request_id).toMatch(UUID_PATTERN);
    expect(outboundRequest(1).headers.request_id).toMatch(UUID_PATTERN);
    expect(outboundRequest(1).headers.request_id).not.toBe(
      outboundRequest(0).headers.request_id
    );
  });

  it('preserves an upstream error status and JSON payload', async () => {
    const errorData = { message: 'upstream rejected the room' };
    fetchMock.mockResolvedValue(upstreamResponse({ data: errorData }, 429));

    const { event, response } = createEvent('POST', { room_id: ROOM_ID });
    const result = await clientTokenHandler(event);

    expect(response.statusCode).toBe(429);
    expect(result).toEqual(errorData);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it('returns a bounded 500 without leaking credentials when fetch throws', async () => {
    fetchMock.mockRejectedValue(
      new Error(`upstream unreachable at ${API_HOST} with ${API_KEY}`)
    );

    const { event, response } = createEvent('POST', { room_id: ROOM_ID });
    const result = await clientTokenHandler(event);

    expect(response.statusCode).toBe(500);
    expect(result).toEqual({
      error: TOKEN_DIAL_API_MESSAGES.tokenGenerationFailed,
    });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain(API_HOST);
  });

  it('returns a bounded 500 when the upstream body is not valid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockRejectedValue(new SyntaxError('invalid json')),
    } as unknown as Response);

    const { event, response } = createEvent('POST', { room_id: ROOM_ID });
    const result = await clientTokenHandler(event);

    expect(response.statusCode).toBe(500);
    expect(result).toEqual({
      error: TOKEN_DIAL_API_MESSAGES.tokenGenerationFailed,
    });
  });

  it.each([
    ['a missing body', undefined],
    ['an empty object', {}],
    ['a missing room id', { refresh_token: REFRESH_TOKEN }],
    ['an empty room id', { room_id: '' }],
    ['a non-string room id', { room_id: 42 }],
  ])('rejects %s before calling upstream', async (_label, body) => {
    const { event, response } = createEvent('POST', body);
    const result = await clientTokenHandler(event);

    expect(response.statusCode).toBe(400);
    expect(result).toEqual({ error: TOKEN_DIAL_API_MESSAGES.invalidRoomId });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before calling upstream', async () => {
    const { event, response } = createEvent('POST', '{"room_id":');
    const result = await clientTokenHandler(event);

    expect(response.statusCode).toBe(400);
    expect(result).toEqual({ error: TOKEN_DIAL_API_MESSAGES.invalidRoomId });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-POST methods with 405 and an Allow header', async () => {
    const { event, response, headers } = createEvent('GET', {
      room_id: ROOM_ID,
    });
    const result = await clientTokenHandler(event);

    expect(response.statusCode).toBe(405);
    expect(headers.allow).toBe('POST');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/refresh_client_token', () => {
  it('refreshes a client token without requiring a room id', async () => {
    const tokenData = { token: 'refreshed-client-token' };
    fetchMock.mockResolvedValue(upstreamResponse({ data: tokenData }));

    const { event, response } = createEvent('POST', {
      refresh_token: REFRESH_TOKEN,
    });
    const result = await refreshClientTokenHandler(event);

    expect(response.statusCode).toBe(200);
    expect(result).toEqual(tokenData);

    const { url, headers, init, body } = outboundRequest();
    // The browser only posts refresh_token, so the legacy path resolves
    // against a literal undefined room id and must keep doing so.
    expect(url).toBe(
      `${API_HOST}/rooms/undefined/actions/refresh_client_token`
    );
    expect(init?.method).toBe('POST');
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.request_id).toMatch(UUID_PATTERN);
    expect(body).toEqual({
      refresh_token: REFRESH_TOKEN,
      token_ttl_secs: 120,
    });
  });

  it('uses a supplied room id in the upstream path', async () => {
    fetchMock.mockResolvedValue(upstreamResponse({ data: {} }));

    await refreshClientTokenHandler(
      createEvent('POST', {
        room_id: ROOM_ID,
        refresh_token: REFRESH_TOKEN,
      }).event
    );

    expect(outboundRequest().url).toBe(
      `${API_HOST}/rooms/${ROOM_ID}/actions/refresh_client_token`
    );
  });

  it('preserves an upstream error status and JSON payload', async () => {
    const errorData = { message: 'refresh token expired' };
    fetchMock.mockResolvedValue(upstreamResponse({ data: errorData }, 401));

    const { event, response } = createEvent('POST', {
      refresh_token: REFRESH_TOKEN,
    });
    const result = await refreshClientTokenHandler(event);

    expect(response.statusCode).toBe(401);
    expect(result).toEqual(errorData);
    expect(JSON.stringify(result)).not.toContain(REFRESH_TOKEN);
  });

  it('returns a bounded 500 without leaking the refresh token', async () => {
    fetchMock.mockRejectedValue(
      new Error(`refresh failed for ${REFRESH_TOKEN} at ${API_HOST}`)
    );

    const { event, response } = createEvent('POST', {
      refresh_token: REFRESH_TOKEN,
    });
    const result = await refreshClientTokenHandler(event);

    expect(response.statusCode).toBe(500);
    expect(result).toEqual({
      error: TOKEN_DIAL_API_MESSAGES.tokenRefreshFailed,
    });
    expect(JSON.stringify(result)).not.toContain(REFRESH_TOKEN);
    expect(JSON.stringify(result)).not.toContain(API_HOST);
  });

  it.each([
    ['a missing body', undefined],
    ['an empty object', {}],
    ['an empty refresh token', { refresh_token: '' }],
    ['a non-string refresh token', { refresh_token: 123 }],
  ])('rejects %s before calling upstream', async (_label, body) => {
    const { event, response } = createEvent('POST', body);
    const result = await refreshClientTokenHandler(event);

    expect(response.statusCode).toBe(400);
    expect(result).toEqual({
      error: TOKEN_DIAL_API_MESSAGES.invalidRefreshToken,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-POST methods with 405 and an Allow header', async () => {
    const { event, response, headers } = createEvent('GET', {
      refresh_token: REFRESH_TOKEN,
    });
    const result = await refreshClientTokenHandler(event);

    expect(response.statusCode).toBe(405);
    expect(headers.allow).toBe('POST');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/dial_out', () => {
  const context = { id: 123456, username: PHONE_NUMBER };

  it('dials out through the call-control host with a serialized context', async () => {
    const dialOutData = { call_control_id: 'call-control-id' };
    fetchMock.mockResolvedValue(upstreamResponse({ data: dialOutData }));

    const { event, response } = createEvent('POST', {
      video_room_id: ROOM_ID,
      video_room_context: context,
      to: PHONE_NUMBER,
    });
    const result = await dialOutHandler(event);

    expect(response.statusCode).toBe(200);
    expect(result).toEqual(dialOutData);

    const { url, headers, init, body } = outboundRequest();
    expect(url).toBe(`${CALL_CONTROL_HOST}/dial_out`);
    expect(init?.method).toBe('POST');
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.request_id).toMatch(UUID_PATTERN);
    expect(body).toEqual({
      video_room_id: ROOM_ID,
      video_room_context: JSON.stringify(context),
      to: PHONE_NUMBER,
    });
  });

  it('preserves an upstream error status and JSON payload', async () => {
    const errorData = { message: 'destination is unreachable' };
    fetchMock.mockResolvedValue(upstreamResponse({ data: errorData }, 422));

    const { event, response } = createEvent('POST', {
      video_room_id: ROOM_ID,
      video_room_context: context,
      to: PHONE_NUMBER,
    });
    const result = await dialOutHandler(event);

    expect(response.statusCode).toBe(422);
    expect(result).toEqual(errorData);
  });

  it('returns a bounded 500 without leaking credentials when fetch throws', async () => {
    fetchMock.mockRejectedValue(
      new Error(`dial out failed at ${CALL_CONTROL_HOST} with ${API_KEY}`)
    );

    const { event, response } = createEvent('POST', {
      video_room_id: ROOM_ID,
      video_room_context: context,
      to: PHONE_NUMBER,
    });
    const result = await dialOutHandler(event);

    expect(response.statusCode).toBe(500);
    expect(result).toEqual({ error: TOKEN_DIAL_API_MESSAGES.dialOutFailed });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain(CALL_CONTROL_HOST);
  });

  it.each([
    ['a missing body', undefined],
    ['an empty object', {}],
    [
      'a missing video room id',
      { video_room_context: context, to: PHONE_NUMBER },
    ],
    [
      'a missing video room context',
      { video_room_id: ROOM_ID, to: PHONE_NUMBER },
    ],
    [
      'a missing destination',
      { video_room_id: ROOM_ID, video_room_context: context },
    ],
    [
      'an empty destination',
      { video_room_id: ROOM_ID, video_room_context: context, to: '' },
    ],
  ])('rejects %s before calling upstream', async (_label, body) => {
    const { event, response } = createEvent('POST', body);
    const result = await dialOutHandler(event);

    expect(response.statusCode).toBe(400);
    expect(result).toEqual({ error: TOKEN_DIAL_API_MESSAGES.invalidDialOut });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-POST methods with 405 and an Allow header', async () => {
    const { event, response, headers } = createEvent('GET', {
      video_room_id: ROOM_ID,
      video_room_context: context,
      to: PHONE_NUMBER,
    });
    const result = await dialOutHandler(event);

    expect(response.statusCode).toBe(405);
    expect(headers.allow).toBe('POST');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Telnyx configuration', () => {
  it('falls back to private Nuxt runtime config when env vars are absent', () => {
    vi.stubEnv('TELNYX_API_KEY', '');
    vi.stubEnv('TELNYX_API_HOST', '');
    vi.stubEnv('TELNYX_CALL_CONTROL_API_HOST', '');
    vi.stubGlobal(
      'useRuntimeConfig',
      vi.fn(() => ({
        telnxApiKey: 'runtime-config-key',
        telnxApiHost: 'https://runtime.example.test/v2/',
        telnxCallControlApiHost: 'https://runtime-call.example.test/v2/',
      }))
    );

    expect(resolveTelnyxUpstreamConfig()).toEqual({
      apiKey: 'runtime-config-key',
      apiHost: 'https://runtime.example.test/v2',
      callControlApiHost: 'https://runtime-call.example.test/v2',
    });
  });
});
