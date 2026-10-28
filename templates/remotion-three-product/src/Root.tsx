import React from "react";
import { Composition } from "remotion";
import { ProductVideo } from "./Video";
import { defaultProductProps, productVideoSchema } from "./content";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="VideurVideo"
    component={ProductVideo}
    durationInFrames={300}
    fps={30}
    width={1280}
    height={720}
    schema={productVideoSchema}
    defaultProps={defaultProductProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round(props.duration * props.fps)),
      fps: props.fps,
      width: props.width,
      height: props.height,
    })}
  />
);
