import type { MediaMetadata } from "@videur/contracts";
import type { VideurConfig } from "../config";
import { detectBlackFrames, type BlackDetection } from "../media/blackdetect";
import { generateContactSheet } from "../media/contact-sheet";
import { probeMedia } from "../media/ffprobe";

export class MediaService {
  constructor(private readonly config: VideurConfig) {}

  probe(filePath: string): Promise<MediaMetadata> {
    return probeMedia(filePath, this.config.binaries.ffprobe);
  }

  contactSheet(inputPath: string, outputPath: string, duration: number): Promise<string> {
    return generateContactSheet({
      inputPath,
      outputPath,
      duration,
      ffmpeg: this.config.binaries.ffmpeg,
    });
  }

  blackdetect(filePath: string, duration: number): Promise<BlackDetection> {
    return detectBlackFrames(filePath, duration, this.config.binaries.ffmpeg);
  }
}
