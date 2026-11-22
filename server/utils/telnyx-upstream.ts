import { randomUUID } from 'node:crypto';
import {
  getMethod,
  readBody,
  setResponseHeader,
  setResponseStatus,
  type H3Event,
} from 'h3';

const DEFAULT_TELNYX_API_HOST = 'https://api.telnyx.com/v2';

export const TOKEN_DIAL_API_MESSAGES = {
  invalidRoomId: 'Invalid room ID',
  invalidRefreshToken: 'Invalid refresh token',
  invalidDialOut: 'Invalid dial out request',
  tokenGenerationFailed: 'Failed to generate client token',
  tokenRefreshFailed: 'Failed to refresh client token',
  dialOutFailed: 'Failed to dial out',
} as const;

export type TelnyxUpstreamConfig = {
  apiKey: string;
  apiHost: string;
  callControlApiHost: string;
};

export type TelnyxUpstreamResult = {
  requestId: string;
  status: number;
  data: unknown;
};

export type TelnyxPostRequest = {
  host: string;
  path: string;
  body: unknown;
  authorize?: boolean;
};

type RuntimeConfigLike = {
  telnxApiKey?: unknown;
  telnxApiHost?: unknown;
  telnxCallControlApiHost?: unknown;
};

type JsonBody = Record<string, unknown>;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const isRecord = (value: unknown): value is JsonBody =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isPresent = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.length > 0;
  }

  return value !== undefined && value !== null;
};

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

export const resolveTelnyxUpstreamConfig = (
  event?: H3Event
): TelnyxUpstreamConfig => {
  const config = readRuntimeConfig(event);
  const apiKey =
    process.env.TELNYX_API_KEY || asString(config.telnxApiKey) || '';
  const apiHost = (
    process.env.TELNYX_API_HOST ||
    asString(config.telnxApiHost) ||
    DEFAULT_TELNYX_API_HOST
  ).replace(/\/+$/, '');
  const callControlApiHost = (
    process.env.TELNYX_CALL_CONTROL_API_HOST ||
    asString(config.telnxCallControlApiHost) ||
    apiHost
  ).replace(/\/+$/, '');

  return { apiKey, apiHost, callControlApiHost };
};

const readJsonBody = async (event: H3Event): Promise<JsonBody | undefined> => {
  try {
    const body: unknown = await readBody(event);

    return isRecord(body) ? body : undefined;
  } catch {
    // Malformed JSON and unsupported payloads are caller errors. The route
    // reports them before any outbound call is made.
    return undefined;
  }
};

const rejectUnsupportedMethod = (event: H3Event): boolean => {
  if (getMethod(event) === 'POST') {
    return false;
  }

  setResponseHeader(event, 'Allow', 'POST');
  setResponseStatus(event, 405);

  return true;
};

export const postTelnyxUpstream = async (
  event: H3Event,
  { host, path, body, authorize = false }: TelnyxPostRequest
): Promise<TelnyxUpstreamResult> => {
  const requestId = randomUUID();
  const { apiKey } = resolveTelnyxUpstreamConfig(event);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    request_id: requestId,
  };

  if (authorize) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${host}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });

  const payload: unknown = await response.json();
  const data = isRecord(payload) && 'data' in payload ? payload.data : payload;

  return {
    requestId,
    // The legacy token and dial-out routes always answered 200 on an upstream
    // success, even if the upstream used another 2xx status.
    status: response.ok ? 200 : response.status,
    data,
  };
};

const respondWithUpstream = async (
  event: H3Event,
  request: TelnyxPostRequest,
  failureMessage: string
): Promise<unknown> => {
  try {
    const { status, data } = await postTelnyxUpstream(event, request);

    setResponseStatus(event, status);

    return data;
  } catch {
    // Never echo the thrown error: it can contain the upstream URL, request
    // details, caller tokens, or credentials supplied by the runtime
    // environment.
    setResponseStatus(event, 500);

    return { error: failureMessage };
  }
};

export const handleClientToken = async (event: H3Event): Promise<unknown> => {
  if (rejectUnsupportedMethod(event)) {
    return null;
  }

  const body = await readJsonBody(event);

  if (!body || !isNonEmptyString(body.room_id)) {
    setResponseStatus(event, 400);

    return { error: TOKEN_DIAL_API_MESSAGES.invalidRoomId };
  }

  const { apiHost } = resolveTelnyxUpstreamConfig(event);
  const roomId = encodeURIComponent(body.room_id);

  return respondWithUpstream(
    event,
    {
      host: apiHost,
      path: `/rooms/${roomId}/actions/generate_join_client_token`,
      body: {
        refresh_token_ttl_secs: 3600,
        token_ttl_secs: 60,
      },
      authorize: true,
    },
    TOKEN_DIAL_API_MESSAGES.tokenGenerationFailed
  );
};

export const handleRefreshClientToken = async (
  event: H3Event
): Promise<unknown> => {
  if (rejectUnsupportedMethod(event)) {
    return null;
  }

  const body = await readJsonBody(event);

  // The legacy route only required refresh_token. The browser does not send a
  // room id on refresh, so the path intentionally keeps resolving against an
  // undefined room id to preserve the existing contract.
  if (!body || !isNonEmptyString(body.refresh_token)) {
    setResponseStatus(event, 400);

    return { error: TOKEN_DIAL_API_MESSAGES.invalidRefreshToken };
  }

  const { apiHost } = resolveTelnyxUpstreamConfig(event);
  const roomId = isNonEmptyString(body.room_id) ? body.room_id : undefined;

  return respondWithUpstream(
    event,
    {
      host: apiHost,
      path: `/rooms/${encodeURIComponent(String(roomId))}/actions/refresh_client_token`,
      body: {
        refresh_token: body.refresh_token,
        token_ttl_secs: 120,
      },
    },
    TOKEN_DIAL_API_MESSAGES.tokenRefreshFailed
  );
};

export const handleDialOut = async (event: H3Event): Promise<unknown> => {
  if (rejectUnsupportedMethod(event)) {
    return null;
  }

  const body = await readJsonBody(event);

  if (
    !body ||
    !isNonEmptyString(body.video_room_id) ||
    !isPresent(body.video_room_context) ||
    !isNonEmptyString(body.to)
  ) {
    setResponseStatus(event, 400);

    return { error: TOKEN_DIAL_API_MESSAGES.invalidDialOut };
  }

  const { callControlApiHost } = resolveTelnyxUpstreamConfig(event);

  return respondWithUpstream(
    event,
    {
      host: callControlApiHost,
      path: '/dial_out',
      body: {
        video_room_id: body.video_room_id,
        // The legacy route sends this field as a JSON string nested inside
        // the JSON request body.
        video_room_context: JSON.stringify(body.video_room_context),
        to: body.to,
      },
    },
    TOKEN_DIAL_API_MESSAGES.dialOutFailed
  );
};
