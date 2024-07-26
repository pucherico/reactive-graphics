import { map, of, switchMap, tap } from "rxjs";
import {
  beatAnimation,
  deltaPoint,
  followPointerAtSpeedAnimation,
  movementAtSpeed,
  oscillatorAnimation,
  spinAnimation,
} from "../fx";
import {
  ORIGIN,
  rotationMatrix,
  translationMatrix,
  vector,
} from "../geom";
import { Modeler } from "../modeler/modeler";
import { createGraph, GraphEngine } from "../engine";
import { mesa } from "./graphics";

export const scene2 = (engine: GraphEngine) => {
  const drawable = Modeler.new()
    .fillStyle("yellow")
    .newClosedPath()
    .point(0, 0)
    .horizontal(200)
    .vertical(200)
    .fill()
    .build();
  const { draw } = drawable;
  engine.addGraphic(createGraph(draw));
};

export const scene = (engine: GraphEngine) => {
  const { draw: mesaDraw } = mesa;
  engine
    .addGraphic(createGraph(mesaDraw))
    // .effect(graph => new MovementEffect(engine, graph))
    .animate(of(translationMatrix({ x: 100, y: 100 })))
    // .animate(spinAnimation(), true)
    

    // Se podría componer una animación conjunta con estas 4:
    .animate(of(rotationMatrix(Math.PI / 4)))
    .animate(beatAnimation(0.02))
    .animate(of(rotationMatrix(-Math.PI / 4)))
    .animate(beatAnimation(0.02, 800))
    
    .animate(spinAnimation(10000))
    .animate(oscillatorAnimation(100, false, 5000))
    // .effect((graph) => new SpinEffect(engine.frame$, graph, 8000), false)
    // .effect((graph) => new OscillatorEffect(engine.frame$, graph, 100, false, 5000))
    // .effect((graph) => new SpinEffect(engine.frame$, graph, 40000), false)
    // .effect((graph) => new SpinEffect(engine.frame$, graph, 10000), true)

    // .animate((context) =>
    //   context.pointer.click$.pipe(
    //     tap((point) => {
    //       const p = context.deviceTransformation().transform(point);
    //       const pc = context.devicePointInContext(point);
    //       const oc = context.graphPointInContext(ORIGIN);
    //       const o = context.graphTransformation().transform(ORIGIN);
    //       const xc = context.graphPointInContext({ x: 0, y: 100 });
    //       console.log(
    //         `click at (${point.x}, ${point.y}), in context (${pc.x}, ${pc.y}) -> (${p.x}, ${p.y})`
    //       );
    //       console.log(`origin in context (${oc.x}, ${oc.y}) -->(${o.x}, ${o.y})`);
    //       console.log(`graph (0, 100) in context (${xc.x}, ${xc.y})`);
    //     }),
    //     map(() => Identity)
    //   )
    // )
    // .animate(movementAnimation(ORIGIN, { x: 400, y: 100 }, 10000))
    // .animate(movementAtSpeedAnimation(ORIGIN, { x: 400, y: 100 }, 50))
    // .animate(followPathAnimation())
    // .animate(of(translationMatrix({ x: 200, y: 200 })));
    .animate(followPointerAtSpeedAnimation(50))
};

export const sceneX = (engine: GraphEngine) => {
  const { draw: mesaDraw } = mesa;
  engine
    .addGraphic(createGraph(mesaDraw))
    // .transform(scalingMatrix(0.5, 1).translate({ x: 200, y: 200 }))
    // .transform(translationMatrix({ x: 200, y: 200 }))
    /// idem to .translate({ x: 200, y: 200 }) // possible new method
    // .effect((graph) => new SpinEffect(engine.frame$, graph, 4000), true)
    // .effect((graph) => new OscillatorEffect(engine.frame$, graph, 100, false, 5000))
    // .effect((graph) => new SpinEffect(engine.frame$, graph, 40000), false)
    .animate(of(translationMatrix({ x: 200, y: 200 })))
    // .effect((graph) => new SpinEffect(engine.frame$, graph, 4000), false)
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
    .animate(
      // DEMO using left and right matrix accumulation: using graph context coordinates system
      (context) =>
        engine.pointer.click$.pipe(
          /// TODO crear operator graphPointerVector(graph, index)
          map((point) => ({
            pointInContext: context.devicePointInContext(point),
            graphOrigin: context.graphPointInContext(ORIGIN),
          })), // point and ORIGIN in graph context coordinates
          tap(({ pointInContext, graphOrigin }) =>
            console.log(
              `pointInContext: ${pointInContext.x}, ${pointInContext.y}. graph Origin: ${graphOrigin.x}, ${graphOrigin.y}`
            )
          ),
          map(({ pointInContext, graphOrigin }) =>
            vector(graphOrigin, pointInContext)
          ),
          /// TODO fin operator graphPointerVector(graph, index)

          switchMap((vect) =>
            engine.frame$.pipe(
              // takeDuring(1000),
              // velocity(vect, 100),

              // movement(ORIGIN, vect, 1000, false),
              movementAtSpeed(ORIGIN, vect, 200, false),
              // bezierMovementAtSpeed(
              //   ORIGIN,
              //   { x: vect.x, y: 0 },
              //   { x: 0, y: vect.y },
              //   vect,
              //   200,
              //   false
              // ),

              deltaPoint(),
              map((point) => translationMatrix(point))
            )
          )
          // tap((vect) => console.log(`vector: ${vect.x}, ${vect.y}`)),
          // map(() => Identity)
        ),
      false
    )
    // .animate(of(translationMatrix({ x: 100, y: 0 })))
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
    // .animate(
    //   engine.frame$.pipe(
    //     deltaTime,
    //     unitsPerSecond(-Math.PI / 2),
    //     map((radians) => rotationMatrix(radians))
    //   ),
    //   true
    // );
    .animate(of(translationMatrix({ x: -100, y: -100 })));
  // .animate(of(scalingMatrix(0.5, 1)))
  // .effect((graph) => new SpinEffect(engine.frame$, graph, 4000), true)
  // .effect(
  //   (graph) => new OscillatorEffect(engine.frame$, graph, 100, false, 5000)
  // );
  // .effect((graph) => new FollowVectorsEffect(engine.frame$, graph, vectors))
  // .effect((graph) => new SpinEffect(engine.frame$, graph, 4000), false);
};

export default scene;
