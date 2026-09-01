import type { Config } from "@hooksmith/core";
import {
  logFromExternalExtension,
  metadataEquals,
} from "https://raw.githubusercontent.com/Kralizek/hooksmith-test-extension/ceae29a9e8fdb7507e32eed1b87171a4c602c2b2/mod.ts";

export default {
  routes: [
    {
      name: "external-extension",
      when: metadataEquals("integration", "remote"),
      listeners: [logFromExternalExtension()],
    },
  ],
} satisfies Config;
