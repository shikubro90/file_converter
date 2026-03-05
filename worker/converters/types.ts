export interface SpawnCommand {
  cmd: string;
  args: string[];
}

export interface ConverterPlugin {
  /** Human-readable name for logging */
  name: string;
  /** Exact MIME types or wildcards: "image/*", "audio/*", "video/*", "*" */
  supportedInputs: string[];
  /** Target file extensions this plugin can produce */
  supportedOutputs: string[];
  /** Returns the command to run — no shell interpolation, always array args */
  buildCommand(inputPath: string, outputPath: string, sourceMime: string, targetExt: string): SpawnCommand;
  /** Optional hook to run after the process exits (e.g. rename LibreOffice output) */
  afterRun?(inputPath: string, outputPath: string): Promise<void>;
}
