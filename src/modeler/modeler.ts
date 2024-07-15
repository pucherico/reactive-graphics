import { Drawable } from "../render";
import { Identity, Matrix, ORIGIN } from "../geom";
import { PathBuilder } from "./path";

interface PathModel<M> {
  builder: PathBuilder<M>;
  fill: boolean;
}

interface PathInfo {
  path: Path2D;
  fill: boolean;
}

const enum RequestType {
  PATH_MODEL,
  FILL_PATH2D,
  STROKE_PATH2D,
  MODELER,
  DRAWABLE,
  CONTEXT_CMD,
}

const enum CommandType {
  PATH,
  DRAWABLE,
  CONTEXT_CMD,
}

type ContextCommand = (ctx: CanvasRenderingContext2D) => void;

interface Request<M> {
  type: RequestType;
  payload: PathModel<M> | Path2D | Modeler | Drawable | ContextCommand;
  transform?: Matrix;
}

interface Command {
  type: CommandType;
  action: PathInfo | Drawable | ContextCommand;
}

export class ModelerContext<M> {
  constructor(public readonly modeler: M, private requests: Request<M>[]) {}

  fill(builder: PathBuilder<M>) {
    if (this.modeler !== null) {
      this.endPath(builder, true);
    }
  }

  stroke(builder: PathBuilder<M>) {
    if (this.modeler !== null) {
      this.endPath(builder, false);
    }
  }

  private endPath(builder: PathBuilder<M>, fill: boolean) {
    this.requests.push({
      type: RequestType.PATH_MODEL,
      payload: { builder, fill },
      transform: Identity,
    });
  }
}

export class Modeler {
  constructor(private requests: Request<Modeler>[] = []) {}

  static new(): Modeler {
    /// newGraphic() | newGraphObject() ó graphic() | graphObject() | functional() | path2D(path2D | (path2D)=> {}})
    /// Descendiente GraphModeler: path2D(path2D | () => path2D, left, top, right, bottom)
    return new Modeler();
  }

  static newHorizontalSymmetry(source: Modeler, y = 0): Modeler {
    const transform = Identity.translate({ x: 0, y })
      .scale(1, -1)
      .translate({ x: 0, y: -y });
    return Modeler.new().include(source, transform);
  }

  static newVerticalSymmetry(source: Modeler, x = 0): Modeler {
    const transform = Identity.translate({ x, y: 0 })
      .scale(-1, 1)
      .translate({ x: -x, y: 0 });
    return Modeler.new().include(source, transform);
  }

  newPath(): PathBuilder<Modeler> {
    const context = new ModelerContext(this, this.requests);
    return new PathBuilder<Modeler>([], false, context);
  }

  newClosedPath(): PathBuilder<Modeler> {
    const context = new ModelerContext(this, this.requests);
    return new PathBuilder<Modeler>([], true, context);
  }

  fillRect(x: number, y: number, w: number, h: number): Modeler {
    const translateFn = (ctx: CanvasRenderingContext2D) => {
      ctx.fillRect(x, y, w, h);
    };
    return this.withContext(translateFn);
  }

  strokeRect(x: number, y: number, w: number, h: number): Modeler {
    const translateFn = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeRect(x, y, w, h);
    };
    return this.withContext(translateFn);
  }

  /// idem circle, ellipse,... revisar API Path2D

  fillPath2D(path2D: Path2D, transform: Matrix = Identity): Modeler {
    this.requests.push({
      type: RequestType.FILL_PATH2D,
      payload: path2D,
      transform,
    });
    return this;
  }

  strokePath2D(path2D: Path2D, transform: Matrix = Identity): Modeler {
    this.requests.push({
      type: RequestType.STROKE_PATH2D,
      payload: path2D,
      transform,
    });
    return this;
  }

  include(modeler: Modeler, transform: Matrix = Identity): Modeler {
    /// añadir parámetro opcional: transform
    this.requests.push({
      type: RequestType.MODELER,
      payload: modeler,
      transform,
    });
    return this;
  }

  includeGraphic(graph: Drawable, transform: Matrix = Identity): Modeler {
    this.requests.push({
      type: RequestType.DRAWABLE,
      payload: graph,
      transform,
    });
    return this;
  }

  withContext(fn: (ctx: CanvasRenderingContext2D) => void): Modeler {
    this.requests.push({
      type: RequestType.CONTEXT_CMD,
      payload: fn,
      transform: undefined,
    });
    return this;
  }

  fillStyle(style: string): Modeler {
    const setStyle = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = style;
    };
    return this.withContext(setStyle);
  }

  strokeStyle(style: string): Modeler {
    const setStyle = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = style;
    };
    return this.withContext(setStyle);
  }

  build(): Drawable {
    return this.buildWithTransform(Identity);
  }

  private buildWithTransform(transform: Matrix): Drawable {
    const commands: Command[] = this.requests.map((request) => {
      if (request.type === RequestType.PATH_MODEL) {
        const pm: PathModel<Modeler> = request.payload as PathModel<Modeler>;
        if (!request.transform)
          throw new Error("transform is required for PATH MODEL");
        // Realizamos la construcción de Path2D's de antemano (en lugar de desde el objeto devuelvo)
        const path = new Path2D();
        const t1 = new DOMMatrix(transform.coefficients);
        const t2 = new DOMMatrix(request.transform.coefficients);
        const t = t1.multiply(t2);
        path.addPath(pm.builder.buildPath(), t);
        const pi: PathInfo = { path, fill: pm.fill };
        return { type: CommandType.PATH, action: pi } as Command;
      } else if (request.type === RequestType.FILL_PATH2D) {
        const requestPath: Path2D = request.payload as Path2D;
        if (!request.transform)
          throw new Error("transform is required for FILL_PATH2D");
        const path = new Path2D();
        const t1 = new DOMMatrix(transform.coefficients);
        const t2 = new DOMMatrix(request.transform.coefficients);
        const t = t1.multiply(t2);
        path.addPath(requestPath, t);
        const pi: PathInfo = { path, fill: true };
        return { type: CommandType.PATH, action: pi };
      } else if (request.type === RequestType.STROKE_PATH2D) {
        const requestPath: Path2D = request.payload as Path2D;
        if (!request.transform)
          throw new Error("transform is required for STROKE_PATH2D");
        const path = new Path2D();
        const t1 = new DOMMatrix(transform.coefficients);
        const t2 = new DOMMatrix(request.transform.coefficients);
        const t = t1.multiply(t2);
        path.addPath(requestPath, t);
        const pi: PathInfo = { path, fill: false };
        return { type: CommandType.PATH, action: pi };
      } else if (request.type === RequestType.MODELER) {
        const submodel: Modeler = request.payload as Modeler;
        if (!request.transform)
          throw new Error("transform is required for MODELER");
        const t1 = new DOMMatrix(transform.coefficients);
        const t2 = new DOMMatrix(request.transform.coefficients);
        const t = t1.multiply(t2);
        // Matrix.getInstance(coefficients)
        const tt = Identity.translate(ORIGIN); /// forma artifical para crear matriz para inicializar posteriormente asignando coeficientes (pendiente refectorizar Matrix)
        tt.coefficients = [t.a, t.b, t.c, t.d, t.e, t.f];
        const graph = submodel.buildWithTransform(tt);
        return { type: CommandType.DRAWABLE, action: graph };
      } else if (request.type === RequestType.DRAWABLE) {
        const graph: Drawable = request.payload as Drawable;
        if (!request.transform)
          throw new Error("transform is required for DRAWABLE");
        const t1 = new DOMMatrix(transform.coefficients);
        const t2 = new DOMMatrix(request.transform.coefficients);
        const t = t1.multiply(t2);
        const transformedGraph = new TransformDrawable(
          [t.a, t.b, t.c, t.d, t.e, t.f],
          graph
        );
        return { type: CommandType.DRAWABLE, action: transformedGraph };
      } else {
        // request.type === RequestType.CONTEXT_CMD
        const ccmd = request.payload as ContextCommand;
        return { type: CommandType.CONTEXT_CMD, action: ccmd } as Command;
      }
    });
    return {
      draw(context: CanvasRenderingContext2D) {
        context.save();
        commands.forEach((command) => {
          if (command.type === CommandType.PATH) {
            const pathInfo = command.action as PathInfo;
            if (pathInfo.fill) {
              context.fill(pathInfo.path);
            } else {
              context.stroke(pathInfo.path);
            }
          } else if (command.type === CommandType.DRAWABLE) {
            const graph = command.action as Drawable;
            context.save();
            ///context.setTransform()
            graph.draw(context);
            context.restore();
          } else {
            // command.type === CommandType.CONTEXT_CMD
            const ccmd = command.action as ContextCommand;
            ccmd(context);
          }
        });
        context.restore();
      },
      // isPointInGraph(point: Point) {
      //   commands.forEach()
      //   return context.isPointInPath(pathInfo.path);
      // }
    };
  }
}

class TransformDrawable implements Drawable {
  constructor(
    private transform: [number, number, number, number, number, number],
    private graph: Drawable
  ) {}

  draw(context: CanvasRenderingContext2D) {
    context.save();
    context.transform(...this.transform);
    this.graph.draw(context);
    context.restore();
  }
}
