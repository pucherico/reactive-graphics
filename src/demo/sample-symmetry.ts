import { of } from "rxjs";
import {
  Drawable,
  GraphObject,
  Identity,
  Matrix,
  Modeler,
  ORIGIN,
  PathBuilder,
  Point,
} from "..";
import { GraphEngine } from "../engine";

const X_OFFSET = 15, Y_OFFSET = -15;

/**
 * Implementación provisional de los métodos de GraphObject.
 * En el futuro el API de modelado debería ser capaz de generar GraphObjects
 * en lugar de solo Drawables (permitiendo definir qué paths cerrados intervienen en
 * la comprobación de colisión y en qué orden).
 */
class Graph implements GraphObject {
  private base: Drawable;
  private boundingPath: Path2D;

  constructor() {
    const unPath = PathBuilder.newPath()
      .point(75, 75, false)
      .point(50, 50, true)
      .vertical(-10, true)
      .point(75, 25, false)
      .reflection()
      .forward(100, Math.PI / 4, true)
      .point(300, 75, false)
      .reflection()
      .forward(100, Math.PI / 4, true)
      .points(350, 250);
    const otroPath = PathBuilder.symmetricPath(unPath);
    unPath.mergePath(PathBuilder.reversePath(otroPath));
    const graphModel = Modeler.new()
      .strokeStyle("white")
      .withContext((ctx) => (ctx.lineWidth = 3))
      // .strokePath2D(unPath.buildPath())
      .strokePath2D(unPath.buildPath(), Identity.translate({ x: X_OFFSET, y: Y_OFFSET }))
      .strokeStyle("grey")
      .strokePath2D(otroPath.buildPath());
    this.base = graphModel.build();
    this.boundingPath = unPath.buildPath();
  }
  
  // getBoundingRect(): Rect {
  //   return new Rect({ x: X_OFFSET, y: Y_OFFSET }, { x: 500 + X_OFFSET, y: 500 + Y_OFFSET });
  // }
  
  maybePointInGraph(_matrix: Matrix, _point: Point): boolean {
    return true;
  }
  
  isPointInGraph(context: CanvasDrawPath, point: Point): boolean {
    const translatedPath = new Path2D();
    translatedPath.addPath(this.boundingPath, new DOMMatrix(Identity.translate({ x: X_OFFSET, y: Y_OFFSET }).coefficients));
    return context.isPointInPath(translatedPath, point.x, point.y);
  }
  
  collisionDetectionPoints(): Point[] {
    throw new Error("Method not implemented.");
  }

  // getBoundaries(): Rect[] {
  //   throw [this.getBoundingRect()];
  // }

  draw(context: CanvasRenderingContext2D): void {
    this.base.draw(context);
  }
}

const graph = new Graph();
export default (engine: GraphEngine) => {
  engine
  .addGraphic(graph)
  // .animate(of(Identity.translate({ x: 100, y: 0 }).scale(0.5, 1)));
  .transform(Identity.translate({ x: 100, y: 0 }).scale(0.5, 1));
// engine.layerTransformer(engine.currentLayer)
//   .scale(0.5, 0.5)
//   .rotate(-Math.PI / 4)
//   .translate(0, 100);

};
