import { Identity, Matrix, ORIGIN, Point, vector } from "..";
import { Modeler, ModelerContext } from "./modeler";

const makeCoords = (...coords: number[]): Point[] => {
  if (coords.length % 2 !== 0) {
    throw Error(`polyline doesn't have an even number of arguments`);
  }
  const { points } = coords
    .map((coord) => ({ points: [] as Point[], coord }))
    .reduce((acc, cur, index: number) => {
      if (index % 2 === 0) {
        return { points: acc.points, coord: cur.coord };
      } else {
        return {
          points: [...acc.points, { x: acc.coord, y: cur.coord }],
          coord: 0,
        };
      }
    });
  return points;
};

export class Vertex {
  constructor(public point: Point, public isControl: boolean = false) {}

  get x(): number {
    return this.point.x;
  }

  get y(): number {
    return this.point.y;
  }
}

export class PathBuilder {
  private constructor(
    private vertexes: Vertex[],
    private readonly closedPath: boolean,
    private context: ModelerContext | null
  ) {}

  static newPath(context: ModelerContext | null = null): PathBuilder {
    return new PathBuilder([], false, context);
  }

  static newClosedPath(context: ModelerContext | null = null): PathBuilder {
    return new PathBuilder([], true, context);
  }

  static reversePath(source: PathBuilder): PathBuilder {
    return new PathBuilder(source.vertexes.reverse(), source.closedPath, null);
  }

  static symmetricPathHorizontal(source: PathBuilder, y = 0): PathBuilder {
    const vertexes = source.vertexes.map(
      (vertex) =>
        new Vertex({ x: vertex.x, y: y - (vertex.y - y) }, vertex.isControl)
    );
    return new PathBuilder(vertexes, source.closedPath, null);
  }

  static symmetricPathVertical(source: PathBuilder, x = 0): PathBuilder {
    const vertexes = source.vertexes.map(
      (vertex) =>
        new Vertex({ x: x - (vertex.x - x), y: vertex.y }, vertex.isControl)
    );
    return new PathBuilder(vertexes, source.closedPath, null);
  }

  static symmetricPath(source: PathBuilder): PathBuilder {
    if (source.vertexes.length < 2) {
      return source;
    }
    const first = source.firstPoint();
    const last = source.lastPoint();
    const dir = vector(first, last);
    // const alpha = Math.acos(dir.x / Math.sqrt(dir.x * dir.x + dir.y * dir.y)); // unsigned angle (always > 0)
    const alpha = Math.atan2(dir.y, dir.x); // signed angle
    const transform: Matrix = Identity.translate(first)
      .rotate(alpha)
      .scale(1, -1)
      .rotate(-alpha)
      .translate(vector(first, ORIGIN));
    return PathBuilder.transformPath(source, transform);
  }

  static transformPath(source: PathBuilder, transform: Matrix): PathBuilder {
    const vertexes = source.vertexes.map(
      (vertex) =>
        new Vertex(transform.transform(vertex.point), vertex.isControl)
    );
    return new PathBuilder(vertexes, source.closedPath, null);
  }

  static functionalPath(
    f: (x: number) => number,
    x0: number,
    x1: number,
    increment: number
  ): PathBuilder {
    const vertexes: Vertex[] = [];
    for (let x = x0; x < x1; x += increment) {
      const y = f(x);
      vertexes.push(new Vertex({ x, y }, false));
    }
    return new PathBuilder(vertexes, false, null);
  }

  static top(source: PathBuilder): number {
    return Math.min(...source.vertexes.map((vertex) => vertex.y));
  }

  static topVertexes(source: PathBuilder): Vertex[] {
    const top = PathBuilder.top(source);
    return source.vertexes.filter((vertex) => vertex.y === top);
  }

  static bottom(source: PathBuilder): number {
    return Math.max(...source.vertexes.map((vertex) => vertex.y));
  }

  static bottomVertexes(source: PathBuilder): Vertex[] {
    const bottom = PathBuilder.bottom(source);
    return source.vertexes.filter((vertex) => vertex.y === bottom);
  }

  static left(source: PathBuilder): number {
    return Math.min(...source.vertexes.map((vertex) => vertex.x));
  }

  static leftVertexes(source: PathBuilder): Vertex[] {
    const left = PathBuilder.left(source);
    return source.vertexes.filter((vertex) => vertex.x === left);
  }

  static right(source: PathBuilder): number {
    return Math.max(...source.vertexes.map((vertex) => vertex.x));
  }

  static rightVertexes(source: PathBuilder): Vertex[] {
    const right = PathBuilder.right(source);
    return source.vertexes.filter((vertex) => vertex.x === right);
  }

  static firstVertex(source: PathBuilder): Vertex | null {
    return source.vertexes.length > 0 ? source.vertexes[0] : null;
  }

  static lastVertex(source: PathBuilder): Vertex | null {
    return source.vertexes.length > 0
      ? source.vertexes[source.vertexes.length - 1]
      : null;
  }

  static nearestVertex(source: PathBuilder, point: Point): Vertex {
    const { vertex } = source.vertexes
      .map((vertex) => {
        const v = vector(point, vertex.point);
        const distance2 = v.x * v.x + v.y * v.y;
        return { vertex, distance2 };
      })
      .reduce((acc, cur) => (cur.distance2 < acc.distance2 ? cur : acc));
    return vertex;
  }

  // static pathBetween(source, vertex1, vertex2)

  // static box(source, left, top, right, bottom): new builder using points from the source, translated and scaled to fit in box

  // directed angle from u to v
  private static angle(u: Point, v: Point): number {
    // const uv = u.x * v.x + u.y * v.y;
    // const modU = Math.sqrt(u.x * u.x + u.y * u.y);
    // const modV = Math.sqrt(v.x * v.x + v.y * v.y);
    // return Math.acos(uv / (modU * modV));
    return Math.atan2(v.y, v.x) - Math.atan2(u.y, u.x);
  }

  vertex(vertex: Vertex): PathBuilder {
    this.vertexes.push(vertex);
    return this;
  }

  points(...coords: number[]): PathBuilder {
    const newVertexes = makeCoords(...coords).map((point) => new Vertex(point));
    this.vertexes.push(...newVertexes);
    return this;
  }

  point(
    x: number,
    y: number,
    controlPoint: boolean = false,
    vertexCb: ((vertex: Vertex) => void) | null = null
  ): PathBuilder {
    const vertex = new Vertex({ x, y }, controlPoint);
    this.vertexes.push(vertex);
    if (vertexCb !== null) {
      vertexCb(vertex);
    }
    return this;
  }

  horizontal(
    x: number,
    controlPoint: boolean = false,
    vertexCb: ((vertex: Vertex) => void) | null = null
  ): PathBuilder {
    const last = this.lastPoint();
    return this.point(x, last.y, controlPoint, vertexCb);
  }

  vertical(
    y: number,
    controlPoint: boolean = false,
    vertexCb: ((vertex: Vertex) => void) | null = null
  ): PathBuilder {
    const last = this.lastPoint();
    return this.point(last.x, y, controlPoint, vertexCb);
  }

  // Create a calculated control point reflection from the two last points
  // Idem to forwardSegment(1, 0, true, vertexCb), but more efficient
  reflection(vertexCb: ((vertex: Vertex) => void) | null = null): PathBuilder {
    if (this.vertexes.length === 0) {
      return this; // do nothing
    }
    const [previous, last] = this.lastTwoPoints();
    const v: Point = vector(previous, last);
    return this.point(last.x + v.x, last.y + v.y, true, vertexCb);
  }

  increments(...coords: number[]): PathBuilder {
    const start =
      this.vertexes.length > 0
        ? this.vertexes[this.vertexes.length - 1].point
        : ORIGIN; // last point
    const relatives = makeCoords(...coords);
    const absolutes = relatives.reduce(
      (acc, cur) => {
        const last = acc[acc.length - 1];
        return [...acc, { x: last.x + cur.x, y: last.y + cur.y }];
      },
      [start]
    );
    const [_first, ...newPoints] = absolutes;
    const newVertexes = newPoints.map((point) => new Vertex(point));
    this.vertexes.push(...newVertexes);
    return this;
  }

  increment(
    deltaX: number,
    deltaY: number,
    controlPoint: boolean = false,
    vertexCb: ((vertex: Vertex) => void) | null = null
  ): PathBuilder {
    const last = this.lastPoint();
    const vertex = new Vertex(
      { x: last.x + deltaX, y: last.y + deltaY },
      controlPoint
    );
    this.vertexes.push(vertex);
    if (vertexCb !== null) {
      vertexCb(vertex);
    }
    return this;
  }

  forward(
    radius: number,
    alpha: number = 0,
    controlPoint: boolean = false,
    vertexCb?: (vertex: Vertex) => void
  ): PathBuilder {
    if (this.vertexes.length === 0) {
      return this; // do nothing
    }
    const [previous, last] = this.lastTwoPoints();
    const v: Point = Identity.rotate(alpha).transform(vector(previous, last));
    return this.forwardVector(v.x, v.y, radius, controlPoint, vertexCb);
  }

  forwardSegment(
    segmentProportion: number,
    alpha: number = 0,
    controlPoint: boolean = false,
    vertexCb?: (vertex: Vertex) => void
  ): PathBuilder {
    if (this.vertexes.length === 0) {
      return this; // do nothing
    }
    const [previous, last] = this.lastTwoPoints();
    const v: Point = Identity.rotate(alpha).transform(vector(previous, last));
    return this.point(
      last.x + segmentProportion * v.x,
      last.y + segmentProportion * v.y,
      controlPoint,
      vertexCb
    );
  }

  forwardVector(
    x: number,
    y: number,
    distance = 0,
    controlPoint: boolean = false,
    vertexCb?: (vertex: Vertex) => void
  ): PathBuilder {
    const last = this.lastPoint();
    const h = Math.sqrt(x * x + y * y);
    const v: Point =
      distance === 0
        ? { x, y }
        : { x: (x * distance) / h, y: (y * distance) / h };
    return this.point(last.x + v.x, last.y + v.y, controlPoint, vertexCb);
  }

  forwardPoint(
    x: number,
    y: number,
    distance = 0,
    controlPoint: boolean = false,
    vertexCb?: (vertex: Vertex) => void
  ): PathBuilder {
    const last = this.lastPoint();
    const vect = vector(last, { x, y });
    const h = Math.sqrt(vect.x * vect.x + vect.y * vect.y);
    const v: Point =
      distance === 0
        ? vect
        : { x: (vect.x * distance) / h, y: (vect.y * distance) / h };
    return this.point(last.x + v.x, last.y + v.y, controlPoint, vertexCb);
  }

  // Añade los puntos del path dado al propio path. Si el punto inicial del path dado coincidiera con el final del propio path, se evitará el duplicado.
  mergePath(source: PathBuilder): PathBuilder {
    let vertexes: Vertex[];
    if (this.vertexes.length > 0 && source.vertexes.length > 0) {
      const last = this.vertexes[this.vertexes.length - 1];
      const sourceFirst = source.vertexes[0];
      if (last.x === sourceFirst.x && last.y === sourceFirst.y) {
        const [_first, ...rest] = source.vertexes;
        vertexes = rest;
      } else {
        vertexes = source.vertexes;
      }
    } else {
      vertexes = source.vertexes;
    }
    this.vertexes.push(...vertexes);
    return this;
  }

  // translate source path so its first point is the same as the last point of this path, then add all points to this path
  joinPath(source: PathBuilder): PathBuilder {
    if (this.vertexes.length > 0 && source.vertexes.length > 0) {
      const last = this.vertexes[this.vertexes.length - 1];
      const sourceFirst = source.vertexes[0];
      if (last.x !== sourceFirst.x || last.y !== sourceFirst.y) {
        const translationVect = vector(sourceFirst, last);
        const translation = Identity.translate(translationVect);
        source.transformPath(translation);
      }
      return this.mergePath(source);
    }
    return this;
  }

  fitAndJoinPath(source: PathBuilder): PathBuilder {
    if (this.vertexes.length < 2) {
      return this; // do nothing
    }
    source.fitBetweenPoints(
      this.vertexes[this.vertexes.length - 1].point,
      this.vertexes[0].point
    );
    return this.mergePath(source);
  }

  transformPath(transform: Matrix): PathBuilder {
    this.vertexes.forEach(
      (vertex) => (vertex.point = transform.transform(vertex.point))
    );
    return this;
  }

  /// mapVertexes

  // geom. transform path to fit the given points
  fitBetweenPoints(first: Point, last: Point): PathBuilder {
    if (this.vertexes.length < 2) {
      return this;
    }
    const dir = vector(first, last);
    const modulus = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    const pathFirst = this.firstPoint();
    const pathLast = this.lastPoint();
    const pathDir = vector(pathFirst, pathLast);
    const pathMod = Math.sqrt(pathDir.x * pathDir.x + pathDir.y * pathDir.y);
    const s = modulus / pathMod;
    const transform = Identity.translate(first)
      .rotate(PathBuilder.angle(pathDir, dir))
      .scale(s, s)
      .translate(vector(pathFirst, ORIGIN));
    return this.transformPath(transform);
  }

  private firstPoint(): Point {
    return this.vertexes.length > 0 ? this.vertexes[0].point : ORIGIN;
  }

  private lastPoint(): Point {
    return this.vertexes.length > 0
      ? this.vertexes[this.vertexes.length - 1].point
      : ORIGIN;
  }

  private lastTwoPoints(): [Point, Point] {
    if (this.vertexes.length === 0) {
      // if length is 1 we consider ORIGIN as the previous one
      throw new Error("path has no points");
    }
    const last = this.vertexes[this.vertexes.length - 1].point;
    const previous =
      this.vertexes.length > 1
        ? this.vertexes[this.vertexes.length - 2].point
        : ORIGIN;
    return [previous, last];
  }

  // fill and end path
  fill(): Modeler | undefined {
    this.context?.fill(this);
    return this.context?.modeler;
  }

  // stroke and end path
  stroke(): Modeler | undefined {
    this.context?.stroke(this);
    return this.context?.modeler;
  }

  fillToCanvas(context: CanvasRenderingContext2D) {
    const [first, ...rest] = this.vertexes;
    context.beginPath();
    context.moveTo(first.point.x, first.point.y);
    rest.forEach((vertex) => context.lineTo(vertex.point.x, vertex.point.y));
    if (this.closedPath) {
      context.closePath();
    }
    context.fill();
  }

  strokeToCanvas(context: CanvasRenderingContext2D) {
    const [first, ...rest] = this.vertexes;
    context.beginPath();
    context.moveTo(first.point.x, first.point.y);
    rest.forEach((vertex) => context.lineTo(vertex.point.x, vertex.point.y));
    if (this.closedPath) {
      context.closePath();
    }
    context.stroke();
  }

  buildPath(): Path2D {
    const path = new Path2D();
    if (this.vertexes.length === 0) {
      return path;
    }
    const [first, ...rest] = this.vertexes;
    path.moveTo(first.point.x, first.point.y);
    // rest.forEach((vertex) => path.lineTo(vertex.point.x, vertex.point.y));
    let inControl = false; // true cuando se haya procesado algún punto de control
    let control1: Point | null = null;
    let control2: Point | null = null;
    rest.forEach((vertex) => {
      if (vertex.isControl) {
        if (!inControl) {
          // first control point
          inControl = true;
          control1 = vertex.point;
        } else {
          // second control point
          control2 = vertex.point;
        }
      } else {
        // check if first non control point after control point
        if (control1 !== null) {
          // if (inControl)
          const { x, y } = vertex.point;
          if (control2 === null) {
            // curve with 1 control point
            path.quadraticCurveTo(control1.x, control1.y, x, y);
          } else {
            // curve with 2 control points
            path.bezierCurveTo(
              control1.x,
              control1.y,
              control2.x,
              control2.y,
              x,
              y
            );
          }
          // reset control
          inControl = false;
          control1 = control2 = null;
        } else {
          // just another non control point
          path.lineTo(vertex.point.x, vertex.point.y);
        }
      }
    });
    if (this.closedPath) {
      path.closePath();
    }
    return path;
  }
}
