import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
<h1>Simple Reactive Graphics demo</h1>
<div class="container">
<canvas width="500" height="500"></canvas>
<p>Drag me</p>
</div>
`;

import {
  GraphEngine,
  Identity,
  Modeler,
  PathBuilder,
  TranslateLayerEffect,
} from ".";
import { grid } from "./demo/sample-grid";
import graph1 from "./demo/graph1";
import { SpinEffect } from "./fx";
import { scene, scene2 } from "./demo/sample-effects";

const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("canvas not found");
const engine = new GraphEngine(canvas);

grid(engine);

// scene2(engine);
scene(engine);

const wave = PathBuilder.functionalPath(
  (x) => 25 * Math.sin((x * 2 * Math.PI) / 100),
  0,
  350
);

engine.addGraphic(
  Modeler.new().strokeStyle("pink").strokePath2D(wave.buildPath()).build()
);
engine
  .addObject(graph1)
  .transform(Identity.translate({ x: 100, y: 0 }).scale(0.5, 1));
// engine.layerTransformer(engine.currentLayer)
//   .scale(0.5, 0.5)
//   .rotate(-Math.PI / 4)
//   .translate(0, 100);
engine.playEffect(new TranslateLayerEffect(engine, engine.currentLayer));
// engine.playEffect(new SpinEffect(engine.frame$, graph1));
