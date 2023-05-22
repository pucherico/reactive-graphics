import { Modeler } from "../../modeler/modeler";
import { PathBuilder } from "../../modeler/path";

export const wavePath2D = PathBuilder.functionalPath(
  (x) => 25 * Math.sin((x * 2 * Math.PI) / 100),
  0,
  350
).buildPath();

export const wave = Modeler.new()
  .strokeStyle("pink")
  .strokePath2D(wavePath2D)
  .build();
