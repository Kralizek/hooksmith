import type { Context } from "@hooksmith/core";
import { createRuntime } from "@hooksmith/runtime";
import { fromSqs } from "@hooksmith/aws/sqs";
import { createProcessor } from "@hooksmith/aws-lambda";
import { createHandler } from "@hooksmith/aws-lambda/sqs";
import config, {
  type QueueItem,
  type QueueItemEvent,
} from "./hooksmith.config.ts";

const context: Context = {
  log: {
    debug(message, ...args) {
      console.debug(message, ...args);
    },
    info(message, ...args) {
      console.info(message, ...args);
    },
    warn(message, ...args) {
      console.warn(message, ...args);
    },
    error(message, ...args) {
      console.error(message, ...args);
    },
  },
};

const runtime = createRuntime<QueueItemEvent>(config, context);
const processor = createProcessor<QueueItem>(runtime);

export const handler = createHandler<QueueItem>(
  (record) => fromSqs<QueueItem>(record),
  processor,
  {
    onRecordError(error, record) {
      context.log.error(`Failed SQS record ${record.messageId}.`, error);
    },
  },
);
