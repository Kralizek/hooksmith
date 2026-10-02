import { assertEquals } from "@std/assert";
import type { Context, TransformContext } from "@hooksmith/core";
import { nullLoggerFactory } from "@hooksmith/runtime";
import { parseOpenGraph } from "./mod.ts";

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

Deno.test("parseOpenGraph preserves greater-than characters inside quoted attributes", async () => {
  const html = '<meta property="og:title" content="A > B">';
  const result = await parseOpenGraph().transform(html, transformContext);
  assertEquals(result, { title: "A > B" });
});

Deno.test("parseOpenGraph decodes HTML entities exactly once", async () => {
  const html = '<meta property="og:title" content="&amp;lt;tag&amp;gt;">';
  const result = await parseOpenGraph().transform(html, transformContext);
  assertEquals(result, { title: "&lt;tag&gt;" });
});

Deno.test("parseOpenGraph ignores commented-out metadata", async () => {
  const html = `<!-- <meta property="og:title" content="Commented"> -->
    <meta property="og:title" content="Real">`;

  const result = await parseOpenGraph().transform(html, transformContext);
  assertEquals(result, { title: "Real" });
});

Deno.test("parseOpenGraph ignores metadata-like text inside script and style", async () => {
  const html = `
    <script>const sample = '<meta property="og:title" content="Script">';</script>
    <style>.example::before { content: "<meta property='og:title' content='Style'>"; }</style>
    <meta property="og:title" content="Real">
  `;

  const result = await parseOpenGraph().transform(html, transformContext);
  assertEquals(result, { title: "Real" });
});

Deno.test("parseOpenGraph ignores script and style tags with greater-than attributes", async () => {
  const html = `
    <script data-example="a > b"><meta property="og:title" content="Script"></script>
    <style data-example="a > b"><meta property="og:title" content="Style"></style>
    <title data-example="a > b">Fallback</title>
  `;

  const result = await parseOpenGraph().transform(html, transformContext);
  assertEquals(result, { title: "Fallback" });
});
