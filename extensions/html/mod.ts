import type { TransformContext, Transformer } from "@hooksmith/core";
import {
  getText,
  type HeaderSource,
  type ValueOrFactory,
} from "@hooksmith/http";

/** Open Graph metadata extracted from an HTML document. */
export interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
}

/** Options for parsing Open Graph metadata from HTML. */
export interface ParseOpenGraphOptions {
  baseUrl?: string | URL;
}

/** Options for fetching and parsing Open Graph metadata. */
export interface GetOpenGraphOptions<TInput, TOutput = OpenGraphMetadata> {
  name?: string;
  url: ValueOrFactory<string | URL, TInput, TransformContext>;
  headers?:
    | HeaderSource<TInput, TransformContext>
    | readonly HeaderSource<TInput, TransformContext>[];
  map?: (
    input: TInput,
    metadata: OpenGraphMetadata,
  ) => TOutput | Promise<TOutput>;
}

/** Parses Open Graph metadata from the current HTML pipeline value. */
export function parseOpenGraph(
  options: ParseOpenGraphOptions = {},
): Transformer<string, OpenGraphMetadata> {
  return {
    name: "html-parse-open-graph",
    transform(html) {
      return parseOpenGraphDocument(html, options.baseUrl);
    },
  };
}

/** Fetches an HTML page and replaces the current value with Open Graph metadata. */
export function getOpenGraph<TInput, TOutput = OpenGraphMetadata>(
  options: GetOpenGraphOptions<TInput, TOutput>,
): Transformer<TInput, TOutput> {
  const name = options.name ?? "html-get-open-graph";

  return {
    name,
    async transform(input, context): Promise<TOutput> {
      const resolvedUrl = await resolve(options.url, input, context);
      const html = await getText<TInput>({
        name: `${name}:fetch`,
        url: resolvedUrl,
        headers: options.headers,
      }).transform(input, context);

      const metadata = parseOpenGraphDocument(html, resolvedUrl);
      return options.map
        ? await options.map(input, metadata)
        : metadata as unknown as TOutput;
    },
  };
}

function parseOpenGraphDocument(
  html: string,
  baseUrl?: string | URL,
): OpenGraphMetadata {
  const values = new Map<string, string>();
  const document = stripIgnoredHtml(html);

  for (
    const match of document.matchAll(
      /<meta\b(?:"[^"]*"|'[^']*'|[^'">])*>/giu,
    )
  ) {
    const attributes = parseAttributes(match[0]);
    const property = (
      attributes.get("property") ??
        attributes.get("name")
    )?.toLowerCase();
    const content = attributes.get("content");
    if (!property || content === undefined) continue;
    if (!values.has(property)) values.set(property, decodeHtml(content));
  }

  const title = values.get("og:title") ?? readTitle(document);
  const description = values.get("og:description") ??
    values.get("description");

  return compact({
    title,
    description,
    image: resolveUrl(values.get("og:image"), baseUrl),
    url: resolveUrl(values.get("og:url"), baseUrl),
    type: values.get("og:type"),
    siteName: values.get("og:site_name"),
  });
}

function stripIgnoredHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(
      /<script\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/script>/giu,
      "",
    )
    .replace(
      /<style\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/style>/giu,
      "",
    );
}

function parseAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern =
    /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/gu;

  for (const match of tag.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (name === "meta") continue;
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }

  return attributes;
}

function readTitle(html: string): string | undefined {
  const match = /<title\b(?:"[^"]*"|'[^']*'|[^'">])*>([\s\S]*?)<\/title>/iu
    .exec(html);
  return match ? decodeHtml(match[1].trim()) : undefined;
}

function decodeHtml(value: string): string {
  return value.replace(
    /&(amp|quot|#39|lt|gt);/gu,
    (entity) => {
      switch (entity) {
        case "&amp;":
          return "&";
        case "&quot;":
          return '"';
        case "&#39;":
          return "'";
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        default:
          return entity;
      }
    },
  );
}

function resolveUrl(
  value: string | undefined,
  baseUrl?: string | URL,
): string | undefined {
  if (value === undefined) return undefined;
  if (baseUrl === undefined) return value;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function compact(value: OpenGraphMetadata): OpenGraphMetadata {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as OpenGraphMetadata;
}

async function resolve<T, TInput>(
  value: ValueOrFactory<T, TInput, TransformContext>,
  input: TInput,
  context: TransformContext,
): Promise<T> {
  return typeof value === "function"
    ? await (value as (
      input: TInput,
      context: TransformContext,
    ) => T | Promise<T>)(input, context)
    : value;
}
