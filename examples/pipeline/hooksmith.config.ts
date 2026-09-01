import type { Config, Event, Listener } from "@hooksmith/core";
import {
  each,
  merge,
  parallel,
  pipe,
  project,
  split,
  when,
} from "@hooksmith/pipeline";
import { eventType } from "@hooksmith/standard";

interface PageData {
  title: string;
  content: string;
  draft: boolean;
}

interface PreparedPage extends PageData {
  title: string;
}

interface Announcement {
  text: string;
  imagePrompt: string;
}

const normalizePage = project<PageData, PageData>(
  (page) => ({
    ...page,
    title: page.title.trim(),
  }),
  "normalize-page",
);

const announcementListener: Listener<Event<Announcement>> = {
  name: "publish-announcement",
  run(event, { log }) {
    log.info("Announcement ready", event.data);
    return { success: true };
  },
};

const announcementPipeline = pipe(
  when((page: PageData) => page.title !== page.title.trim(), normalizePage),
  parallel(
    project((page: PageData) => `${page.title}: ${page.content.slice(0, 120)}`),
    project((page: PageData) => `Illustration for ${page.title}`),
  ),
  project(([text, imagePrompt]) => ({ text, imagePrompt })),
  announcementListener,
);

const summaryListener: Listener<Event<{ items: readonly string[] }>> = {
  name: "log-section-summaries",
  run(event, { log }) {
    log.info("Section summaries", event.data.items);
    return { success: true };
  },
};

const sectionSummaryPipeline = pipe(
  split((page: PageData) => page.content.split("\n\n")),
  each(project((section: string) => section.slice(0, 80))),
  merge(),
  summaryListener,
);

export default {
  routes: [
    {
      name: "published-pages",
      when: eventType("page.published"),
      listeners: [announcementPipeline, sectionSummaryPipeline],
    },
  ],
} satisfies Config<Event<PageData>>;
