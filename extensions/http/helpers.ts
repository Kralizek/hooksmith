import type { Context, Event } from "@hooksmith/core";
import { resolve } from "./request.ts";
import type {
  HeaderSource,
  HttpBody,
  HttpResponseSuccess,
  ValueOrFactory,
} from "./types.ts";

export function headers<TInput = Event, TContext extends Context = Context>(
  ...sources: HeaderSource<TInput, TContext>[]
): HeaderSource<TInput, TContext>[] {
  return sources;
}

export function bearerAuth<
  TInput = Event,
  TContext extends Context = Context,
>(
  token: ValueOrFactory<string, TInput, TContext>,
): HeaderSource<TInput, TContext> {
  return async (input, context) => ({
    Authorization: `Bearer ${await resolve(token, input, context)}`,
  });
}

export function basicAuth<
  TInput = Event,
  TContext extends Context = Context,
>(
  username: ValueOrFactory<string, TInput, TContext>,
  password: ValueOrFactory<string, TInput, TContext>,
): HeaderSource<TInput, TContext> {
  return async (input, context) => {
    const user = await resolve(username, input, context);
    const pass = await resolve(password, input, context);
    return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
  };
}

export function jsonBody<
  TInput extends Event = Event,
  TContext extends Context = Context,
>(
  value: ValueOrFactory<unknown, TInput, TContext>,
): HttpBody<TInput, TContext> {
  return {
    contentType: "application/json",
    async resolve(input, context) {
      return JSON.stringify(await resolve(value, input, context));
    },
  };
}

export function formBody<
  TInput extends Event = Event,
  TContext extends Context = Context,
>(
  value: ValueOrFactory<
    URLSearchParams | Record<string, string>,
    TInput,
    TContext
  >,
): HttpBody<TInput, TContext> {
  return {
    contentType: "application/x-www-form-urlencoded",
    async resolve(input, context) {
      const resolved = await resolve(value, input, context);
      return resolved instanceof URLSearchParams
        ? resolved.toString()
        : new URLSearchParams(resolved).toString();
    },
  };
}

export function textBody<
  TInput extends Event = Event,
  TContext extends Context = Context,
>(
  value: ValueOrFactory<string, TInput, TContext>,
  contentType = "text/plain; charset=utf-8",
): HttpBody<TInput, TContext> {
  return {
    contentType,
    resolve(input, context) {
      return resolve(value, input, context);
    },
  };
}

export function expectStatus<TEvent extends Event = Event>(
  ...expected: number[]
): HttpResponseSuccess<TEvent> {
  if (expected.length === 0) {
    throw new TypeError("expectStatus requires at least one status code");
  }

  return ({ status }) => expected.includes(status);
}
