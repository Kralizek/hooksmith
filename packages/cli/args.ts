export type ReportFormat = "table" | "json" | "tsv";

export interface RunCliOptions {
  eventFiles: string[];
  configFile: string;
  format: ReportFormat;
  plan: boolean;
  allowEmpty: boolean;
}
