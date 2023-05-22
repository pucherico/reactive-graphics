import { createGraph, GraphEngine, Modeler } from "..";
import { TranslateLayerEffect } from "../fx";

export const grid = (engine: GraphEngine) => {
  for (let v = -500; v <= 500; v += 50) {
    engine.addGraphic(
      createGraph(
        Modeler.new()
          // .strokeStyle(v % 100 === 0 ? 'white' : 'grey')
          .strokeStyle(v % 100 === 0 ? "grey" : "green")
          .withContext((ctx) => ctx.setLineDash([2, 3]))
          .newPath()
          .points(-500, v, 500, v)
          .stroke()
          .build()
      )
    );
    engine.addGraphic(
      createGraph(
        Modeler.new()
          // .strokeStyle(v % 100 === 0 ? 'white' : 'grey')
          .strokeStyle(v % 100 === 0 ? "grey" : "green")
          .withContext((ctx) => ctx.setLineDash([2, 3]))
          .newPath()
          .points(v, -500, v, 500)
          .stroke()
          .build()
      )
    );
  }
  engine.addGraphic(
    createGraph(
      Modeler.new()
        .strokeStyle("white")
        .newPath()
        .points(-500, 0, 500, 0)
        .stroke()
        .build()
    )
  );
  engine.addGraphic(
    createGraph(
      Modeler.new()
        .strokeStyle("white")
        .newPath()
        .points(0, -500, 0, 500)
        .stroke()
        .build()
    )
  );
  engine.playEffect(new TranslateLayerEffect(engine, engine.currentLayer));
};
