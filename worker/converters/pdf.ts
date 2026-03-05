import type { ConverterPlugin } from "./types";

export const pdfPlugin: ConverterPlugin = {
  name: "pdf",
  supportedInputs: ["application/pdf"],
  supportedOutputs: ["png", "jpg", "jpeg"],
  buildCommand(inputPath, outputPath) {
    // [0] selects the first page only — passed as a single arg, safe from injection
    return { cmd: "magick", args: [`${inputPath}[0]`, outputPath] };
  },
};
