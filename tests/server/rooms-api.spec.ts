import type { H3Event } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import listHandler from '../../server/api/rooms/index.get';
import roomHandler from '../../server/api/rooms/[roomId].get';
import { ROOM_API_MESSAGES } from '../../server/utils/room-upstream';

const API_KEY = 'test-telnyx-secret-key';
const API_HOST = 'https://api.example.test/v2';
const ROOM_ID = '123e4567-e89b-12d3-a456-426614174000';
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

const createEvent = (
  method: string,
  params: Record<string, string | undefined> = {}
): MockEvent => {
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

  const req = { method, url: '/api/rooms', headers: {} };
  const event = {
    method,
    context: { params: { ...params } },
    node: { req, res: response },
  } as unknown as H3Event;

  return { event, headers, response };
};

const upstreamResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Upstream Error',
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

const outboundRequest = () => {
  const [url, init] = fetchMock.mock.calls[0];
  const headers = (init?.headers ?? {}) as Record<string, string>;

  return { url: String(url), headers, init };
};

beforeEach(() => {
  vi.stubEnv('TELNYX_API_KEY', API_KEY);
  vi.stubEnv('TELNYX_API_HOST', API_HOST);

  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/rooms', () => {
  it('returns the upstream room data and propagates the request id', async () => {
    const rooms = [
      { id: ROOM_ID, unique_name: 'daily-room' },
      { id: '223e4567-e89b-12d3-a456-426614174000', unique_name: 'standup' },
    ];
    fetchMock.mockResolvedValue(upstreamResponse({ data: rooms }));

    const { event, response } = createEvent('GET');
    const result = await listHandler(event);

    expect(response.statusCode).toBe(200);
    expect(result).toEqual(rooms);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { url, headers } = outboundRequest();
    expect(url).toBe(`${API_HOST}/rooms`);
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers.request_id).toMatch(UUID_PATTERN);
  });

  it('uses a fresh request id for every upstream call', async () => {
    fetchMock.mockResolvedValue(upstreamResponse({ data: [] }));

    await listHandler(createEvent('GET').event);
    await listHandler(createEvent('GET').event);

    const firstRequestId = outboundRequest().headers.request_id;
    const secondCall = fetchMock.mock.calls[1];
    const secondHeaders = (secondCall?.[1]?.headers ?? {}) as Record<
      string,
      string
    >;

    expect(firstRequestId).toMatch(UUID_PATTERN);
    expect(secondHeaders.request_id).toMatch(UUID_PATTERN);
    expect(secondHeaders.request_id).not.toBe(firstRequestId);
  });

  it('preserves an upstream error status and JSON payload', async () => {
    const errorData = { message: 'upstream rejected the request' };
    fetchMock.mockResolvedValue(upstreamResponse({ data: errorData }, 429));

    const { event, response } = createEvent('GET');
    const result = await listHandler(event);

    expect(response.statusCode).toBe(429);
    expect(result).toEqual(errorData);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it('returns a bounded 500 without leaking credentials when fetch throws', async () => {
    fetchMock.mockRejectedValue(
      new Error(`upstream unreachable at ${API_HOST} with ${API_KEY}`)
    );

    const { event, response } = createEvent('GET');
    const result = await listHandler(event);

    expect(response.statusCode).toBe(500);
    expect(result).toEqual({ error: ROOM_API_MESSAGES.listFailed });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain(API_HOST);
  });

  it('returns a bounded 500 when the upstream body is not valid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('invalid json')),
    } as unknown as Response);

    const { event, response } = createEvent('GET');
    const result = await listHandler(event);

    expect(response.statusCode).toBe(500);
    expect(result).toEqual({ error: ROOM_API_MESSAGES.listFailed });
  });

  it('rejects non-GET methods with 405 and an Allow header', async () => {
    const { event, response, headers } = createEvent('POST');
    const result = await listHandler(event);

    expect(response.statusCode).toBe(405);
    expect(headers.allow).toBe('GET');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to private Nuxt runtime config when env vars are absent', async () => {
    vi.stubEnv('TELNYX_API_KEY', '');
    vi.stubEnv('TELNYX_API_HOST', '');
    vi.stubGlobal(
      'useRuntimeConfig',
      vi.fn(() => ({
        telnxApiKey: 'runtime-config-key',
        telnxApiHost: 'https://runtime.example.test/v2/',
      }))
    );
    fetchMock.mockResolvedValue(upstreamResponse({ data: [] }));

    await listHandler(createEvent('GET').event);

    const { url, headers } = outboundRequest();
    expect(url).toBe('https://runtime.example.test/v2/rooms');
    expect(headers.Authorization).toBe('Bearer runtime-config-key');
  });
});

describe('GET /api/rooms/:roomId', () => {
  it('returns the upstream room data for a valid room id', async () => {
    const room = { id: ROOM_ID, unique_name: 'daily-room' };
    fetchMock.mockResolvedValue(upstreamResponse({ data: room }));

    const { event, response } = createEvent('GET', { roomId: ROOM_ID });
    const result = await roomHandler(event);

    expect(response.statusCode).toBe(200);
    expect(result).toEqual(room);

    const { url, headers } = outboundRequest();
    expect(url).toBe(`${API_HOST}/rooms/${ROOM_ID}`);
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers.request_id).toMatch(UUID_PATTERN);
  });

  it('preserves an upstream error status and JSON payload', async () => {
    const errorData = { message: 'room not found' };
    fetchMock.mockResolvedValue(upstreamResponse({ data: errorData }, 404));

    const { event, response } = createEvent('GET', { roomId: ROOM_ID });
    const result = await roomHandler(event);

    expect(response.statusCode).toBe(404);
    expect(result).toEqual(errorData);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it('returns a bounded 500 without leaking credentials when fetch throws', async () => {
    fetchMock.mockRejectedValue(
      new Error(`upstream unreachable at ${API_HOST} with ${API_KEY}`)
    );

    const { event, response } = createEvent('GET', { roomId: ROOM_ID });
    const result = await roomHandler(event);

    expect(response.statusCode).toBe(500);
    expect(result).toEqual({ error: ROOM_API_MESSAGES.lookupFailed });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it.each([
    ['a missing room id', undefined],
    ['a non-UUID room id', 'not-a-room'],
    ['a path traversal attempt', '../../etc/passwd'],
    ['an overlong room id', 'a'.repeat(200)],
  ])('rejects %s before calling upstream', async (_label, roomId) => {
    const { event, response } = createEvent('GET', { roomId });
    const result = await roomHandler(event);

    expect(response.statusCode).toBe(400);
    expect(result).toEqual({ error: ROOM_API_MESSAGES.invalidRoomId });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-GET methods with 405 and an Allow header', async () => {
    const { event, response, headers } = createEvent('DELETE', {
      roomId: ROOM_ID,
    });
    const result = await roomHandler(event);

    expect(response.statusCode).toBe(405);
    expect(headers.allow).toBe('GET');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
