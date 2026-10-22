import { NextResponse } from 'next/server';
import { ApiErrorResponse, ApiMeta, ApiSuccessResponse } from '@/types';

export const API_VERSION = '1.0';

/**
 * Standard Success Envelope for /api/v1
 */
export function apiSuccess<T>(
  data: T,
  meta?: Partial<Omit<ApiMeta, 'version'>>,
  status = 200,
  extraHeaders?: HeadersInit
): NextResponse<ApiSuccessResponse<T>> {
  const fullMeta: ApiMeta = {
    version: API_VERSION,
    ...meta,
  };

  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json');

  return NextResponse.json(
    {
      success: true,
      data,
      meta: fullMeta,
    },
    {
      status,
      headers,
    }
  );
}

/**
 * Standard Error Envelope for /api/v1
 */
export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  extraHeaders?: HeadersInit
): NextResponse<ApiErrorResponse> {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json');

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    {
      status,
      headers,
    }
  );
}
