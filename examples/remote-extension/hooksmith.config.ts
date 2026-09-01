import type { Config } from "@hooksmith/core";
import {
  logFromExternalExtension,
  metadataEquals,
} from "hooksmith-test-extension";

export default {
  routes: [
    {
      name: "external-extension",
      when: metadataEquals("integration", "remote"),
      listeners: [logFromExternalExtension()],
    },
  ],
} satisfies Config;
