export interface Point { readonly x: number; readonly y: number }
export const vector = (p: Point, q: Point) => ({x: q.x - p.x, y: q.y - p.y});
export const squareDistance = (p: Point, q: Point) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
export const ORIGIN: Point = {x: 0, y: 0};

export const valuesBetween = (from: number, to: number) => (alpha: number) => from * (1 - alpha) + to * alpha;
export const pointsBetween = (origin: Point, dest: Point) => (alpha: number) =>
  ({x: origin.x * (1 - alpha) + dest.x * alpha, y: origin.y * (1 - alpha) + dest.y * alpha});

export interface Dimension { width: number; height: number }

export class Rect {

  readonly min: Point;
  readonly max: Point;

  constructor(public readonly from: Point, public readonly to: Point) {
      this.min = { x: Math.min(this.from.x, this.to.x), y: Math.min(this.from.y, this.to.y) };
      this.max = { x: Math.max(this.from.x, this.to.x), y: Math.max(this.from.y, this.to.y) };
  }

  static fromDimension(dimension: Dimension): Rect {
    return new Rect(ORIGIN, { x: dimension.width, y: dimension.height });
  }

  inside(point: Point): boolean {
    return this.min.x <= point.x && point.x <= this.max.x
        && this.min.y <= point.y && point.y <= this.max.y;
  }

  contain(r: Rect): boolean {
    return this.inside(r.min) && this.inside(r.max);
  }

  intersect(r: Rect): boolean {
    return this.min.x < r.max.x && this.max.x > r.min.x
        && this.min.y < r.max.y && this.max.y > r.min.y;
  }

  intersection(r: Rect): Rect {
    return new Rect({ x: Math.max(this.min.x, r.min.x), y: Math.max(this.min.y, r.min.y) },
                    { x: Math.min(this.max.x, r.max.x), y: Math.min(this.max.y, r.max.y) });
  }

  boundingRect(r: Rect): Rect {
    return new Rect({ x: Math.min(this.min.x, r.min.x), y: Math.min(this.min.y, r.min.y) },
                    { x: Math.max(this.max.x, r.max.x), y: Math.max(this.max.y, r.max.y) });
  }

  center(): Point {
    return { x: (this.max.x + this.min.x) / 2, y: (this.max.y + this.min.y) / 2 };
  }

  translate(vector: Point): Rect {
    return new Rect({x: this.min.x + vector.x, y: this.min.y + vector.y},
                    {x: this.max.x + vector.x, y: this.max.y + vector.y});
  }

  scale(factor: number): Rect {
    return new Rect({x: this.min.x * factor, y: this.min.y * factor},
                    {x: this.max.x * factor, y: this.max.y * factor});
  }
}

/**
 *  Represent any Homogeneous matrix of the form:
 *
 * [ a | c | e ]
 * [ b | d | f ]
 * [ 0 | 0 | 1 ]
 *
 */
export interface Matrix {

  coefficients: [number, number, number, number, number, number]; // a, b,  c, d,  e, f

  translate(point: Point): Matrix;
  scale(sx: number, sy: number): Matrix;
  rotate(alpha: number): Matrix;
  inverse(): Matrix;
  transform(point: Point): Point;
}

// class HomogeneousMatrix implements Matrix {

//   public static identity: Matrix = new HomogeneousMatrix();

//   private base: number[][];

//   public constructor() {
//     this.base = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
//   }

//   get coefficients(): [number, number, number, number, number, number] {
//     return [
//       this.base[0][0],
//       this.base[1][0],

//       this.base[0][1],
//       this.base[1][1],

//       this.base[0][2],
//       this.base[1][2],
//     ];
//   }

//   set coefficients([a, b, c, d, e, f]: [number, number, number, number, number, number]) {
//     this.base[0][0] = a;
//     this.base[1][0] = b;

//     this.base[0][1] = c;
//     this.base[1][1] = d;

//     this.base[0][2] = e;
//     this.base[1][2] = f;
//   }

//   translate(point: Point, inverse = false): Matrix {
//     const t = new HomogeneousMatrix();
//     t.base[0][2] = inverse ? -point.x : point.x;
//     t.base[1][2] = inverse ? -point.y : point.y;
//     return inverse ? t.multiply(this) : this.multiply(t);
//   }

//   scale(sx: number, sy: number, inverse = false): Matrix {
//     const s = new HomogeneousMatrix();
//     s.base[0][0] = inverse ? 1 / sx : sx;
//     s.base[1][1] = inverse ? 1 / sy : sy;
//     return inverse ? s.multiply(this) : this.multiply(s);
//   }

//   rotate(alpha: number, inverse = false): Matrix {
//     const r = new HomogeneousMatrix();
//     r.base[0][0] = Math.cos(alpha);  r.base[0][1] = inverse ? Math.sin(alpha) : -Math.sin(alpha);
//     r.base[1][0] = inverse ? -Math.sin(alpha) : Math.sin(alpha);  r.base[1][1] = Math.cos(alpha);
//     return inverse ? r.multiply(this) : this.multiply(r);
//   }

//   inverse(): Matrix {
//     const [a, b, c, d, e, f] = this.coefficients;
//     const det =  a * d - c * b; // determinant
//     const inverse = new HomogeneousMatrix();
//     inverse.coefficients = [
//       d / det,                -b / det,
//       -c / det,               a / det,
//       (c * f - d * e) / det,  (b * e - a * f) / det
//     ];
//     return inverse;
//   }

//   transform(point: Point): Point {
//     const b = [point.x, point.y, 1];
//     const result = [0, 0, 0];
//     for (let i = 0; i < 3; i++) {
//       for (let k = 0; k < 3; k++) {
//         result[i] += this.base[i][k] * b[k];
//       }
//     }
//     // Division would be needed if matrix multiplied by non geometrical transformation
//     // return { x: result[0] / result[2], y: result[1] / result[2] };
//     return { x: result[0], y: result[1] };
//   }

//   private multiply(m: HomogeneousMatrix): Matrix {
//     const result = new HomogeneousMatrix();
//     for (let i = 0; i < 3; i++) {
//       for (let j = 0; j < 3; j++) {
//         result.base[i][j] = 0;
//         for (let k = 0; k < 3 ; k++) {
//           result.base[i][j] += this.base[i][k] * m.base[k][j];
//         }
//       }
//     }
//     return result;
//   }
// }

/**
 *  Represent any Homogeneous matrix of the form:
 *
 * [ a | c | e ]
 * [ b | d | f ]
 * [ 0 | 0 | 1 ]
 *
 */
class FastHomogeneousMatrix implements Matrix {

  public static identity: Matrix = new FastHomogeneousMatrix(1, 0,  0, 1,  0, 0);

  public constructor(private a: number, private b: number,
                     private c: number, private d: number,
                     private e: number, private f: number) {}

  get coefficients(): [number, number, number, number, number, number] {
    return [
      this.a, this.b,
      this.c, this.d,
      this.e, this.f
    ];
  }

  set coefficients([a, b, c, d, e, f]: [number, number, number, number, number, number]) {
    this.a = a; this.b = b;
    this.c = c; this.d = d;
    this.e = e; this.f = f;
  }

  translate(point: Point): Matrix {
    const t = new FastHomogeneousMatrix(1, 0,  0, 1,  point.x, point.y);
    return this.multiply(t);
  }

  scale(sx: number, sy: number): Matrix {
    const s = new FastHomogeneousMatrix(sx, 0,  0, sy,  0, 0);
    return this.multiply(s);
  }

  rotate(alpha: number): Matrix {
    const cos = Math.cos(alpha);
    const sin = Math.sin(alpha);
    const r = new FastHomogeneousMatrix(cos, sin,  -sin, cos,  0, 0);
    return this.multiply(r);
  }

  /**
   * Lets M be an homogeneous matrix:
   * M = [A | b]
   *     [0 | 1]
   * where determinant |A| !== 0, then exists A' inverse of A.
   * If A = [a | c], then A' = [ d | -c], and |A| = a * d - c * b
   *        [b | d]            [-b |  a]
   * Then, M' inverse of M is calculated as follows:
   * M' = [A' | -A'*b] / |A|
   *      [0  |  1   ]
   */
  inverse(): Matrix {
    const { a, b, c, d, e, f } = this;
    const det =  a * d - c * b; // determinant
    return new FastHomogeneousMatrix(
                d / det,                -b / det,
                -c / det,               a / det,
                (c * f - d * e) / det,  (b * e - a * f) / det);
  }

  transform(point: Point): Point {
    return { x: this.a * point.x + this.c * point.y + this.e,
             y: this.b * point.x + this.d * point.y + this.f };
  }

  private multiply(m: FastHomogeneousMatrix): Matrix {
    const { a, b, c, d, e, f } = this;
    return new FastHomogeneousMatrix(
                a * m.a + c * m.b,      b * m.a + d * m.b,
                a * m.c + c * m.d,      b * m.c + d * m.d,
                a * m.e + c * m.f + e,  b * m.e + d * m.f + f
    );
  }
}

export const Identity: Matrix = FastHomogeneousMatrix.identity;
