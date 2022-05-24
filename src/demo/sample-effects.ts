import { map, of, switchMap, tap } from "rxjs";
import {
  bezierMovement,
  bezierMovementAtSpeed,
  deltaPoint,
  deltaTime,
  FollowVectorsEffect,
  movement,
  movementAtSpeed,
  OscillatorEffect,
  quadraticMovement,
  SpinEffect,
  takeDuring,
  unitsPerSecond,
  velocity,
} from "../fx";
import {
  Identity,
  ORIGIN,
  rotationMatrix,
  scalingMatrix,
  translationMatrix,
  vector,
} from "../geom";
import { Modeler } from "../modeler/modeler";
import { GraphEngine } from "../render";
import { mesa } from "./graphics";

const vectors = [
  // { x: 0, y: 0 },
  { x: 200, y: 0 },
  // { x: 0, y: 100 },
  { x: -200, y: 0 },
  // { x: 0, y: -100 },
];
export const scene2 = (engine: GraphEngine) => {
  engine.addGraphic(
    Modeler.new()
      .fillStyle("yellow")
      .newClosedPath()
      .point(0, 0)
      .horizontal(200)
      .vertical(200)
      .fill()
      .build()
  );
};

export const scene = (engine: GraphEngine) => {
  engine
    .addGraphic(mesa)
    // .transform(scalingMatrix(0.5, 1).translate({ x: 200, y: 200 }))
    // .transform(translationMatrix({ x: 200, y: 200 }))
    .animate(of(translationMatrix({ x: 200, y: 200 })))
    // .animate( // DEMO simple animation
    //   engine.frame$.pipe(
    //     // frame$
    //     takeDuring(2000),
    //     velocity({ x: 100, y: 100 }, 100),
    //     map((point) => translationMatrix(point))
    //   )
    // )

    // .animateInContext(
    // DEMO using left matrix accumulation
    //   (graph, index) =>
    //     engine.pointer.click$.pipe(
    //       tap((point) => console.log(`point before: ${point.x}, ${point.y}`)),
    //       map((point) => engine.pointInGraphContext(point, graph, index)),
    //       // map((point) => engine.pointInLayer(point, engine.currentLayer)),
    //       // map((point) => ({ x: point.x - 200, y: point.y - 200 })),
    //       // map(point => (console.log(engine.rightTransform(graph, index).transform(ORIGIN)), point)),
    //       tap((point) => console.log(`point after graph context: ${point.x}, ${point.y}`)),
    //       map(point => engine.rightTransform(graph, index).inverse().transform(point)),
    //       tap((point) => console.log(`point after right transform: ${point.x}, ${point.y}`)),
    //       switchMap((point) =>
    //         engine.frame$.pipe(
    //           takeDuring(1000),
    //           velocity(point, 100),
    //           map((point) => translationMatrix(point))
    //         )
    //       )
    //     ),
    //   false
    // )
    // .animateInContext(
    //   // DEMO using left matrix accumulation (GRAPH context coordinates)
    //   (graph, index) =>
    //     engine.pointer.click$.pipe(
    //       tap((point) => console.log(`point before: ${point.x}, ${point.y}`)),
    //       // map((point) => engine.pointInGraphContext(point, graph, index)),
    //       map((point) => engine.pointInGraphContext(point, graph)),
    //       // map((point) => engine.pointInLayer(point, engine.currentLayer)),
    //       // map((point) => ({ x: point.x - 200, y: point.y - 200 })),
    //       // map(point => (console.log(engine.rightTransform(graph, index).transform(ORIGIN)), point)),
    //       tap((point) =>
    //         console.log(`point after graph context: ${point.x}, ${point.y}`)
    //       ),
    //       switchMap((point) =>
    //         engine.frame$.pipe(
    //           takeDuring(1000),
    //           velocity(point, 100),
    //           map((point) => translationMatrix(point))
    //         )
    //       )
    //     ),
    //   false
    // )
    .animateInContext(
      // DEMO using left and right matrix accumulation: using graph context coordinates system
      (graph, index) =>
        engine.pointer.click$.pipe(
          tap((point) => console.log(`point before: ${point.x}, ${point.y}`)),

          /// TODO crear operator graphPointerVector(graph, index)
          map((point) => ({
            pointInContext: engine.pointInContext(point, graph, index),
            graphOrigin: engine.graphPointInContext(ORIGIN, graph, index),
          })), // point and ORIGIN in graph context coordinates
          map(({ pointInContext, graphOrigin }) =>
            vector(graphOrigin, pointInContext)
          ),
          /// TODO fin operator graphPointerVector(graph, index)

          switchMap((vect) =>
            engine.frame$.pipe(
              // takeDuring(1000),
              // velocity(vect, 100),

              // movement(ORIGIN, vect, 1000, false),
              // movementAtSpeed(ORIGIN, vect, 200, false),
              bezierMovementAtSpeed(
                ORIGIN,
                { x: vect.x, y: 0 },
                { x: 0, y: vect.y },
                vect,
                200,
                false
              ),

              deltaPoint(),
              map((point) => translationMatrix(point))
            )
          )
        ),
      false
    )
    .animate(of(translationMatrix({ x: 100, y: 0 })))
    // .animate(
    //   engine.pointer.click$.pipe(
    //     map((point) => engine.pointInLayer(point, engine.currentLayer)),
    //     map((point) => ({ x: point.x - 200, y: point.y - 200 })),
    //     tap((point) => console.log(`point: ${point.x}, ${point.y}`)),
    //     switchMap((point) =>
    //       engine.frame$.pipe(
    //         takeDuring(2000),
    //         velocity(point, 100),
    //         map((point) => translationMatrix(point))
    //       )
    //     )
    //   )
    // )
    // .animate(
    //   engine.frame$.pipe(
    //     // frame$
    //     takeDuring(2000),
    //     velocity({ x: 100, y: 0 }, 50),
    //     map((point) => translationMatrix(point))
    //   )
    // )
    // .animate(of(scalingMatrix(2, 1)))
    .animate(
      engine.frame$.pipe(
        deltaTime,
        unitsPerSecond(-Math.PI / 2),
        map((radians) => rotationMatrix(radians))
      ),
      true
    );
  // .animate(of(scalingMatrix(0.5, 1)))
  // .effect(
  //   (graph) => new OscillatorEffect(engine.frame$, graph, 300, false, 5000)
  // );
  // .effect((graph) => new FollowVectorsEffect(engine.frame$, graph, vectors))
  // .effect((graph) => new SpinEffect(engine.frame$, graph, 4000), true);
};

export default scene;
