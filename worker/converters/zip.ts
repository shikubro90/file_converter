import type { ConverterPlugin } from "./types";

export const zipPlugin: ConverterPlugin = {
  name: "zip",
  // Accept any file type as input for archiving
  supportedInputs: ["*"],
  supportedOutputs: ["zip"],
  buildCommand(inputPath, outputPath) {
    // -j: junk (don't store) directory paths — only the filename is stored inside the archive
    return { cmd: "zip", args: ["-j", outputPath, inputPath] };
  },
};
