/**
 * HTTP ingress contracts shared across Hooksmith hosts and webhook mappers.
 *
 * @module
 */

import type { EventDocument } from "../mod.ts";

/** Normalized HTTP request data exposed to an ingress mapper. */
export interface HttpIngressRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
  readonly body: Uint8Array;
}

/** Context passed to an HTTP ingress mapper. */
export interface HttpIngressContext {
  readonly request: HttpIngressRequest;
}

/** Maps a normalized HTTP ingress request to a Hooksmith event document. */
export type HttpIngressMapper = (
  context: HttpIngressContext,
) => EventDocument | Promise<EventDocument>;
