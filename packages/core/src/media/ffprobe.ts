import { existsSync, statSync } from "node:fs";
import type { AudioStreamInfo, MediaMetadata, VideoStreamInfo } from "@videur/contracts";
import { AppError } from "../errors";
import { runCommand } from "../process/runner";

interface RawStream {
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  nb_frames?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
}

interface RawProbe {
  format?: {
    duration?: string;
    size?: string;
    bit_rate?: string;
    format_name?: string;
  };
  streams?: RawStream[];
}

export function parseFps(value: string | undefined): number {
  if (!value) return 0;
  const [num, den] = value.split("/").map(Number);
  if (!den) return Number.isFinite(num) ? num : 0;
  if (!num) return 0;
  return Math.round((num / den) * 1000) / 1000;
}

export function parseProbe(raw: RawProbe, fileSize = 0): MediaMetadata {
  const videoStream = raw.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = raw.streams?.find((stream) => stream.codec_type === "audio");

  const video: VideoStreamInfo | null = videoStream
    ? {
        codec: videoStream.codec_name ?? "unknown",
        profile: videoStream.profile ?? null,
        width: videoStream.width ?? 0,
        height: videoStream.height ?? 0,
        fps: parseFps(videoStream.r_frame_rate ?? videoStream.avg_frame_rate),
        pixFmt: videoStream.pix_fmt ?? "unknown",
        frames: videoStream.nb_frames ? Number(videoStream.nb_frames) : null,
      }
    : null;

  const audio: AudioStreamInfo | null = audioStream
    ? {
        codec: audioStream.codec_name ?? "unknown",
        sampleRate: Number(audioStream.sample_rate ?? 0),
        channels: audioStream.channels ?? 0,
      }
    : null;

  return {
    duration: Number(raw.format?.duration ?? videoStream?.duration ?? 0),
    size: Number(raw.format?.size ?? fileSize),
    bitrate: Number(raw.format?.bit_rate ?? 0),
    format: raw.format?.format_name ?? "unknown",
    video,
    audio,
  };
}

export async function probeMedia(filePath: string, ffprobe = "ffprobe"): Promise<MediaMetadata> {
  if (!existsSync(filePath)) throw new AppError("MEDIA_NOT_FOUND", `No existe el archivo: ${filePath}`, 404);
  const fileSize = statSync(filePath).size;
  const result = await runCommand(
    [ffprobe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { timeoutMs: 30_000, maxLogBytes: 1_000_000 },
  );

  if (result.exitCode !== 0) {
    throw new AppError("PROBE_FAILED", `ffprobe falló: ${result.stderr.slice(-2000)}`, 422);
  }

  let parsed: RawProbe;
  try {
    parsed = JSON.parse(result.stdout) as RawProbe;
  } catch {
    throw new AppError("PROBE_INVALID", "ffprobe devolvió JSON inválido", 502);
  }
  return parseProbe(parsed, fileSize);
}

export function hasVideo(metadata: MediaMetadata): boolean {
  return Boolean(metadata.video && metadata.video.width > 0 && metadata.video.height > 0);
}
