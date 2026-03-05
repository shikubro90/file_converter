import type { ConverterPlugin } from "./types";

// Codec hints for formats that need explicit guidance
const CODEC_ARGS: Record<string, string[]> = {
  mp3: ["-vn", "-acodec", "libmp3lame"],
  ogg: ["-vn", "-acodec", "libvorbis"],
  wav: ["-vn", "-acodec", "pcm_s16le"],
  mp4: ["-vcodec", "libx264", "-acodec", "aac"],
  webm: ["-vcodec", "libvpx-vp9", "-acodec", "libopus"],
  gif: ["-vf", "fps=10,scale=480:-1:flags=lanczos", "-loop", "0"],
};

export const audioVideoPlugin: ConverterPlugin = {
  name: "audio-video",
  supportedInputs: ["audio/*", "video/*"],
  supportedOutputs: ["mp4", "mp3", "webm", "ogg", "wav", "avi", "mkv", "gif"],
  buildCommand(inputPath, outputPath, _sourceMime, targetExt) {
    const extraArgs = CODEC_ARGS[targetExt] ?? [];
    return {
      cmd: "ffmpeg",
      // -y: overwrite without prompt  -i: input  [codec args]  output
      args: ["-y", "-i", inputPath, ...extraArgs, outputPath],
    };
  },
};
