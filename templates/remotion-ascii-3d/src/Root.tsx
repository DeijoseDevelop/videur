import React from "react";
import { Composition } from "remotion";
import { AsciiCube } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="VideurVideo"
    component={AsciiCube}
    durationInFrames={300}
    fps={30}
    width={1280}
    height={720}
  />
);
