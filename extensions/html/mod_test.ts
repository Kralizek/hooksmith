import { assertEquals } from "@std/assert";
import type { Context, TransformContext } from "@hooksmith/core";
import { nullLoggerFactory } from "@hooksmith/runtime";
import { getOpenGraph, parseOpenGraph } from "./mod.ts";

const context: Context = {
  logger: nullLoggerFactory,
};

const transformContext: TransformContext = {
  ...context,
  originalData: {},
};

Deno.test("parseOpenGraph extracts metadata and resolves relative URLs", async () => {
  const html = `<!doctype html>
    <html>
      <head>
        <meta property="og:title" content="Hello &amp; Hooksmith">
        <meta property="og:description" content="A description">
        <meta property="og:image" content="/image.png">
        <meta property="og:url" content="/article">
        <meta property="og:type" content="article">
        <meta property="og:site_name" content="Example">
      </head>
    </html>`;

  const result = await parseOpenGraph({
    baseUrl: "https://example.test/base",
  }).transform(html, transformContext);

  assertEquals(result, {
    title: "Hello & Hooksmith",
    description: "A description",
    image: "https://example.test/image.png",
    url: "https://example.test/article",
    type: "article",
    siteName: "Example",
  });
});

Deno.test("parseOpenGraph falls back to title and description metadata", async () => {
  const html = `<html><head>
    <title>Fallback title</title>
    <meta name="description" content="Fallback description">
  </head></html>`;

  const result = await parseOpenGraph().transform(html, transformContext);
  assertEquals(result, {
    title: "Fallback title",
    description: "Fallback description",
  });
});

Deno.test("getOpenGraph fetches HTML through the HTTP transformer", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (input) => {
    assertEquals(String(input), "https://example.test/article");
    return Promise.resolve(new Response(
      '<meta property="og:title" content="Fetched">',
    ));
  };

  try {
    const result = await getOpenGraph<unknown>({
      url: "https://example.test/article",
    }).transform({}, transformContext);

    assertEquals(result, { title: "Fetched" });
  } finally {
    globalThis.fetch = original;
  }
});
