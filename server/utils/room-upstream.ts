import { randomUUID } from 'node:crypto';
import {
  getMethod,
  getRouterParam,
  setResponseHeader,
  setResponseStatus,
  type H3Event,
} from 'h3';

const DEFAULT_TELNYX_API_HOST = 'https://api.telnyx.com/v2';

// Telnyx room identifiers are UUIDs. Rejecting anything else keeps the
// upstream path bounded and prevents unexpected path segments from reaching
// the Telnyx API.
const ROOM_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ROOM_API_MESSAGES = {
  invalidRoomId: 'Invalid room ID',
  listFailed: 'Failed to get rooms',
  lookupFailed: 'Failed to get room',
} as const;

export type RoomUpstreamConfig = {
  apiKey: string;
  apiHost: string;
};

export type RoomUpstreamResult = {
  requestId: string;
  status: number;
  data: unknown;
};

type RuntimeConfigLike = {
  telnxApiKey?: unknown;
  telnxApiHost?: unknown;
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// The legacy Next.js routes read process.env directly, so those values are
// preferred. Nuxt's private runtimeConfig remains a fallback for deployments
// that inject configuration there instead. Neither value is ever exposed to
// the client bundle.
const readRuntimeConfig = (event?: H3Event): RuntimeConfigLike => {
  try {
    if (typeof useRuntimeConfig === 'function') {
      return useRuntimeConfig(event) as RuntimeConfigLike;
    }
  } catch {
    // Direct route tests run outside a Nuxt request context.
  }

  return {};
};

export const resolveRoomUpstreamConfig = (
  event?: H3Event
): RoomUpstreamConfig => {
  const config = readRuntimeConfig(event);
  // The legacy Next.js routes read process.env directly. Prefer those values
  // so they can still be set when the server starts, then fall back to Nuxt's
  // private runtimeConfig (and finally the public API default).
  const apiKey =
    process.env.TELNYX_API_KEY || asString(config.telnxApiKey) || '';
  const apiHost =
    process.env.TELNYX_API_HOST ||
    asString(config.telnxApiHost) ||
    DEFAULT_TELNYX_API_HOST;

  return {
    apiKey,
    apiHost: apiHost.replace(/\/+$/, ''),
  };
};

export const isValidRoomId = (roomId: unknown): roomId is string =>
  typeof roomId === 'string' && ROOM_ID_PATTERN.test(roomId);

const rejectUnsupportedMethod = (
  event: H3Event,
  allowedMethod = 'GET'
): boolean => {
  if (getMethod(event) === allowedMethod) {
    return false;
  }

  setResponseHeader(event, 'Allow', allowedMethod);
  setResponseStatus(event, 405);

  return true;
};

export const fetchRoomUpstream = async (
  event: H3Event,
  upstreamPath: string
): Promise<RoomUpstreamResult> => {
  const requestId = randomUUID();
  const { apiKey, apiHost } = resolveRoomUpstreamConfig(event);

  const response = await fetch(`${apiHost}${upstreamPath}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      request_id: requestId,
    },
  });

  const payload: unknown = await response.json();
  const data = isRecord(payload) && 'data' in payload ? payload.data : payload;

  return {
    requestId,
    // The legacy room routes always answered 200 on an upstream success.
    status: response.ok ? 200 : response.status,
    data,
  };
};

const respondWithUpstream = async (
  event: H3Event,
  upstreamPath: string,
  failureMessage: string
): Promise<unknown> => {
  try {
    const { status, data } = await fetchRoomUpstream(event, upstreamPath);

    setResponseStatus(event, status);

    return data;
  } catch {
    // Never echo the thrown error: it can contain the upstream URL, request
    // details, or credentials supplied by the runtime environment.
    setResponseStatus(event, 500);

    return { error: failureMessage };
  }
};

export const handleRoomList = async (event: H3Event): Promise<unknown> => {
  if (rejectUnsupportedMethod(event)) {
    return null;
  }

  return respondWithUpstream(event, '/rooms', ROOM_API_MESSAGES.listFailed);
};

export const handleRoomLookup = async (event: H3Event): Promise<unknown> => {
  if (rejectUnsupportedMethod(event)) {
    return null;
  }

  const roomId = getRouterParam(event, 'roomId');

  if (!isValidRoomId(roomId)) {
    setResponseStatus(event, 400);

    return { error: ROOM_API_MESSAGES.invalidRoomId };
  }

  return respondWithUpstream(
    event,
    `/rooms/${roomId}`,
    ROOM_API_MESSAGES.lookupFailed
  );
};
