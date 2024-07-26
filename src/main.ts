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
} from ".";
import { grid } from "./demo/sample-grid";
import sampleEffects from "./demo/sample-effects";

const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("canvas not found");
const engine = new GraphEngine(canvas);

grid(engine);
// engine.playEffect(new TranslateLayerEffect(engine, engine.currentLayer));

// scene2(engine);
sampleEffects(engine);
// demoSymmetry(engine); // graph object

// engine.addGraphic(wave);

