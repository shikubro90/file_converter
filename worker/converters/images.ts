import type { ConverterPlugin } from "./types";

export const imagesPlugin: ConverterPlugin = {
  name: "images",
  supportedInputs: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
  ],
  supportedOutputs: ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "pdf"],
  buildCommand(inputPath, outputPath) {
    // ImageMagick — args are positional, never interpolated into a shell string
    return { cmd: "magick", args: [inputPath, outputPath] };
  },
};
