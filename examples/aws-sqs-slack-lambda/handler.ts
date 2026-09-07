import { fromSqs } from "@hooksmith/aws/sqs";
import { createProcessor } from "@hooksmith/aws-lambda";
import { createHandler } from "@hooksmith/aws-lambda/sqs";
import {
  createConsoleLogWriter,
  createLoggerFactory,
  createRuntime,
} from "@hooksmith/runtime";
import config from "./hooksmith.config.ts";

const logger = createLoggerFactory({
  write: createConsoleLogWriter(),
});
const context = { logger };
const processor = createProcessor(createRuntime(config, context));

export const handler = createHandler(
  fromSqs,
  processor,
  context,
);
