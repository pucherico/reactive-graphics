import {
  Observable,
  EMPTY,
  of,
  merge,
  concat,
  filter,
  skip,
  take,
  first,
  map,
  switchMap,
  tap,
  share,
  takeWhile,
  scan,
  mapTo,
  isEmpty,
  takeUntil,
  exhaustMap,
  mergeMap,
  distinctUntilChanged,
} from "rxjs";
import {
  valuesBetween,
  pointsBetween,
  Point,
  vector,
  ORIGIN,
  Identity,
  Matrix,
  squareDistance,
  quadraticPoints,
  bezierPoints,
} from "./geom";
import {
  Drawable,
  Traceable,
  GraphObject,
  CanvasEffect,
  GraphEngine,
  Contact,
} from "./render";

// const inputisNotNull = <T>(value: T | null): value is T => value !== null;

const radiansPerSecond = (speed: number) => (ms: number) => (speed * ms) / 1000;
const easyGoing = (alpha: number) =>
  alpha === 0 ? 0 : 1 - Math.sin(2 * Math.PI * alpha) / (2 * Math.PI * alpha);
const easyGoing2 = (alpha: number) =>
  alpha === 0 ? 0 : 1 - Math.sin(4 * Math.PI * alpha) / (4 * Math.PI * alpha);

// Observable operators

/**
 * operator que dada una secuencia de puntos, devuelve los incrementos (vectores) entre ambos.
 * El número de incrementos será una unidad inferior al número de los valores del source.
 */
export const deltaPoint = () => (source: Observable<Point>) =>
  source.pipe(
    scan(
      ({ delta: _, last }: { delta: Point; last: Point }, value: Point) => ({
        delta: vector(last, value),
        last: value,
      }),
      { delta: ORIGIN, last: ORIGIN }
    ),
    skip(1),
    map((st) => st.delta)
  );

const deltaLast = () => (source: Observable<Point>) =>
  source.pipe(
    scan(
      ({ delta: _, last }: { delta: Point; last: Point }, value: Point) => ({
        delta: vector(last, value),
        last: value,
      }),
      { delta: ORIGIN, last: ORIGIN }
    ),
    skip(1)
  );

/** operator que dado una secuencia de tiempos en ms, devuelve los incrementos de tiempos entre valores */
export const deltaTime = (source: Observable<number>) =>
  source.pipe(
    scan(
      ({ time, delta: _ }: { time: number; delta: number }, t: number) => ({
        time: t,
        delta: time === 0 ? 0 : t - time,
      }),
      { time: 0, delta: 0 }
    ),
    map((td) => td.delta)
  );

/** operator que dada una secuencia de tiempos en ms, devuelve los tiempos relativos al primer tiempo */
export const elapsedTime = (source: Observable<number>) =>
  source.pipe(
    scan(
      ({ time, delta: _ }: { time: number; delta: number }, t: number) => ({
        time: t,
        delta: time === 0 ? 0 : t - time,
      }),
      { time: 0, delta: 0 }
    ),
    map((td) => td.delta),
    scan((elapsed, delta) => elapsed + delta, 0)
  );

/**
 * operator que dada una secuencia de tiempos en ms, devuelve secuencia de valores
 * entre 0 y 1 que comprende una duración dada.
 */
const duration = (ms: number) => (source: Observable<number>) =>
  concat(
    source.pipe(
      elapsedTime,
      map((time) => time / ms),
      takeWhile((alpha) => alpha < 1)
    ),
    of(1)
  );

export const takeDuring = (duration: number) => (source: Observable<number>) =>
  concat(
    source.pipe(
      elapsedTime,
      takeWhile((time) => time <= duration)
    ),
    of(duration)
  );

const distanceAtSpeed = (units: number, speed: number) =>
  duration(units / speed);

export const unitsPerSecond = (speed: number) => (source: Observable<number>) =>
  source.pipe(map((time) => (time * speed) / 1000));

export const velocity = (vect: Point, speed?: number) => {
  const mod = speed ? Math.sqrt(vect.x * vect.x + vect.y * vect.y) : 1;
  const v = speed
    ? { x: (vect.x * speed) / mod, y: (vect.y * speed) / mod }
    : vect;
  return (source: Observable<number>) =>
    source.pipe(
      // deltaTime,
      elapsedTime,
      map((time) => ({ x: (v.x * time) / 1000, y: (v.y * time) / 1000 }))
    );
};

/**
 * Operador que dada una secuencia de tiempos en ms, realiza un movimiento PROGRESIVO entre dos puntos dados,
 * con la duración indicada y si se indica, con efecto ease.
 * FLUJO ENTRANTE: tiempos en ms.
 * FLUJO SALIENTE: secuencia puntos entre los extremos dados
 */
export const movement =
  (from: Point, to: Point, ms: number, ease: boolean = false) =>
  (source: Observable<number>) =>
    source.pipe(
      /// Implementar esta lógica en operador moveTo(this.graphic, 500, true) params: Drawable, ms, ease.
      duration(ms),
      // tap(a => console.log(`alpha: ${a}`)),
      map((alpha: number) => (ease ? easyGoing(alpha) : alpha)),
      // tap(a => console.log(`alpha': ${a}`)),
      map(pointsBetween(from, to))
    );

export const quadraticMovement =
  (
    from: Point,
    controlPoint: Point,
    to: Point,
    ms: number,
    ease: boolean = false
  ) =>
  (source: Observable<number>) =>
    source.pipe(
      /// Implementar esta lógica en operador moveTo(this.graphic, 500, true) params: Drawable, ms, ease.
      duration(ms),
      // tap(a => console.log(`alpha: ${a}`)),
      map((alpha: number) => (ease ? easyGoing(alpha) : alpha)),
      // tap(a => console.log(`alpha': ${a}`)),
      map(quadraticPoints(from, controlPoint, to))
    );

export const bezierMovement =
  (
    from: Point,
    controlPoint1: Point,
    controlPoint2: Point,
    to: Point,
    ms: number,
    ease: boolean = false
  ) =>
  (source: Observable<number>) =>
    source.pipe(
      /// Implementar esta lógica en operador moveTo(this.graphic, 500, true) params: Drawable, ms, ease.
      duration(ms),
      // tap(a => console.log(`alpha: ${a}`)),
      map((alpha: number) => (ease ? easyGoing(alpha) : alpha)),
      // tap(a => console.log(`alpha': ${a}`)),
      map(bezierPoints(from, controlPoint1, controlPoint2, to))
    );

/**
 *
 * Operator that given a sequence of timestamps (in ms) produce the points resulting of a movement
 * between two given points at a given speed.
 *
 * INPUT STREAM: timestamps in ms.
 * OUTPUT STREAM: sequence of points.
 */
export const movementAtSpeed = (
  from: Point,
  to: Point,
  speed: number,
  ease: boolean = false
) =>
  movement(
    from,
    to,
    (1000 * Math.sqrt(squareDistance(from, to))) / speed,
    ease
  );

export const quadraticMovementAtSpeed = (
  from: Point,
  controlPoint: Point,
  to: Point,
  speed: number,
  ease: boolean = false
) =>
  quadraticMovement(
    from,
    controlPoint,
    to,
    (1000 * Math.sqrt(squareDistance(from, to))) / speed,
    ease
  );

export const bezierMovementAtSpeed = (
  from: Point,
  controlPoint1: Point,
  controlPoint2: Point,
  to: Point,
  speed: number,
  ease: boolean = false
) =>
  bezierMovement(
    from,
    controlPoint1,
    controlPoint2,
    to,
    (1000 * Math.sqrt(squareDistance(from, to))) / speed,
    ease
  );

/**
 * Operador generalizado que dada una secuencia de tiempos en ms, devuelve una progresión de valores entre 0 y 1,
 * con la duración indicada y si se indica, con efecto ease.
 * FLUJO ENTRANTE: tiempos en ms.
 * FLUJO SALIENTE: secuencia de valores entre 0 y 1
 *
 * NOTA: Para el caso concreto de valores entre dos puntos dados, usar mejor el operador movement.
 * Este operador es una generalización que conviene usar cuando se quieren realizar múltiples operaciones (transformaciones
 * geométricas) progresivas simultáneamente (e.g. trasladar entre dos puntos y escalar).
 */
export const span =
  (ms: number, ease = false) =>
  (source: Observable<number>) =>
    source.pipe(
      duration(ms),
      // tap(a => console.log(`alpha: ${a}`)),
      map((alpha: number) => (ease ? easyGoing(alpha) : alpha))
      // tap(a => console.log(`alpha': ${a}`)),
    );

export const EMPTY_EFFECT: CanvasEffect = { target: null, pulse: () => EMPTY };

/**
 * Conmute effects every time a switch$ (e.g. click$, hold$, etc) event comes.
 */
export class EffectSwitcher implements CanvasEffect {
  public readonly applyFromOrigin = false;
  private next = 0;
  private effects: CanvasEffect[];

  constructor(
    private engine: GraphEngine,
    private switch$: Observable<any>,
    public target: GraphObject,
    private started: boolean,
    ...effects: CanvasEffect[]
  ) {
    this.effects = effects.length > 1 ? effects : [...effects, EMPTY_EFFECT];
  }

  pulse(): Observable<any> {
    const start = this.started ? of(null) : EMPTY; // check whether is initially started
    return concat(
      start,
      this.switch$.pipe(
        this.engine.pointer.filterPointWithContact(this.target),
        map(({ point }) => point)
      )
    ).pipe(
      switchMap(() => this.effects[this.next++ % this.effects.length].pulse())
    );
  }
}

/// TODO Renombrar a DragLayerEffect?
export class TranslateLayerEffect implements CanvasEffect {
  public readonly target: Drawable | null = null;
  public readonly pulse$: Observable<any>;

  constructor(
    engine: GraphEngine,
    layer: number,
    ...dependentLayers: number[]
  ) {
    this.pulse$ = engine.pointer.start$.pipe(
      engine.pointer.filterPointWithoutContact(),
      switchMap((_point) =>
        engine.pointer.move$.pipe(
          takeUntil(engine.pointer.end$),
          map((delta) => engine.pointInLayer(delta, layer)),
          deltaPoint(),
          scan((acc, cur) => ({ x: acc.x + cur.x, y: acc.y + cur.y })), // take into account (conteract) own layer transformation
          tap((delta) => {
            const t = Identity.translate(delta);
            engine.transformLayer(layer, t);
            for (const d of dependentLayers) {
              engine.transformLayer(d, t);
            }
          })
        )
      ),
      share()
    );
  }

  pulse(): Observable<any> {
    return this.pulse$;
  }
}

export class ShiftLayerEffect implements CanvasEffect {
  public readonly target: Drawable | null = null;
  public readonly pulse$: Observable<any>;
  protected readonly delta$: Observable<{ delta: Point; last: Point }>;

  constructor(
    engine: GraphEngine,
    layer: number,
    horizontal: boolean,
    optionalStart$: Observable<Point> | null = null
  ) {
    const start$ =
      optionalStart$ ??
      engine.pointer.start$.pipe(
        engine.pointer.filterPointWithoutContactAboveLayer(layer)
      );
    this.delta$ = start$.pipe(
      switchMap((_point) =>
        engine.pointer.move$.pipe(
          takeUntil(engine.pointer.end$),
          deltaLast(),
          map(({ delta, last }) => ({
            delta: horizontal ? { x: delta.x, y: 0 } : { x: 0, y: delta.y },
            last,
          }))
        )
      )
    );
    this.pulse$ = this.delta$.pipe(
      tap(({ delta, last: _ }) =>
        engine.layerTransformer().translate(delta.x, delta.y)
      ),
      share()
    );
  }

  pulse(): Observable<any> {
    return this.pulse$;
  }
}

export class FocusLayerEffect implements CanvasEffect {
  public readonly target: Drawable | null = null;
  public readonly pulse$: Observable<any>;

  constructor(
    private engine: GraphEngine,
    private layer: number,
    private focusPoint$: Observable<Point>
  ) {
    this.pulse$ = this.focusPoint$.pipe(
      map((point) => {
        const [_a, _b, _c, _d, e, f] = this.engine.layerGeomCoefficients(
          this.layer
        );
        return [{ x: e, y: f }, point] as [Point, Point];
      }),
      switchMap(([origin, dest]: [Point, Point]) =>
        this.engine.frameOfLayer(layer).pipe(
          movement(origin, dest, 500, true),
          tap((point) => {
            const [a, b, c, d, _e, _f] = this.engine.layerGeomCoefficients(
              this.layer
            );
            this.engine.setLayerGeomCoefficients(this.layer, [
              a,
              b,
              c,
              d,
              point.x,
              point.y,
            ]);
          })
        )
      ),
      share()
    );
  }

  pulse(): Observable<any> {
    return this.pulse$;
  }
}

export class MoveGraphEffect implements CanvasEffect {
  public readonly target: Drawable | null = null;
  public readonly pulse$: Observable<any>;

  constructor(
    engine: GraphEngine,
    graphMove$: Observable<{ graph: GraphObject; dest: Point }>,
    ms = 500,
    ease = true
  ) {
    this.pulse$ = graphMove$.pipe(
      map(({ graph, dest }) => ({ graph, origin: graph.position, dest })),
      mergeMap(({ graph, origin, dest }) =>
        engine.frame(graph).pipe(
          movement(origin, dest, ms, ease),
          tap((point) => (graph.position = point))
        )
      ),
      share()
    );
  }

  pulse(): Observable<any> {
    return this.pulse$;
  }
}

export interface Spinwise {
  spin: number;
}

// deprecated
export class OldSpinEffect implements CanvasEffect {
  constructor(
    private frame$: Observable<number>,
    public target: Drawable & Spinwise,
    private clockwise = true
  ) {}

  pulse(): Observable<any> {
    return this.frame$.pipe(
      deltaTime,
      map(radiansPerSecond(Math.PI / 4)),
      map((radians) => (this.clockwise ? radians : -radians)),
      tap((radians) => (this.target.spin += radians)),
      share()
    );
  }
}

export class SpinEffect implements CanvasEffect {
  constructor(
    private frame$: Observable<number>,
    public target: Drawable,
    private period: number = 1000 // ms (negative for anticlockwise spin)
  ) {}

  pulse(): Observable<Matrix> {
    return this.frame$.pipe(
      deltaTime,
      map((duration) => (2 * Math.PI * duration) / this.period),
      map((radians) => Identity.rotate(radians))
    );
  }
}

export class OscillatorEffect implements CanvasEffect {
  constructor(
    private frame$: Observable<number>,
    public target: Drawable,
    private amplitude: number,
    private horizontal: boolean = true,
    private period: number = 1000 // ms (negative for anticlockwise spin)
  ) {}

  pulse(): Observable<Matrix> {
    const offsetToPoint: (offset: number) => Point = this.horizontal
      ? (offset) => ({ x: offset, y: 0 })
      : (offset) => ({ x: 0, y: offset });
    return this.frame$.pipe(
      elapsedTime,
      map((time) => (2 * Math.PI * time) / this.period), // mapTimeToRadians(period)
      map((radians) => Math.sin(radians) * this.amplitude),
      map(offsetToPoint),
      deltaPoint(),
      map((vect) => Identity.translate(vect))
    );
  }
}

export class FollowVectorsEffect implements CanvasEffect {
  constructor(
    private frame$: Observable<number>,
    public target: Drawable,
    private vectors: Point[],
    private period: number = 1000
  ) {} // ms

  pulse(): Observable<Matrix> {
    return this.frame$.pipe(
      elapsedTime,
      map((time) => ((time / this.period) >> 0) % this.vectors.length),
      distinctUntilChanged(),
      map((index) => this.vectors[index]),
      map((vect) => Identity.translate(vect))
    );
  }
}
/// FollowPathEffect

export class QuarterTurnEffect implements CanvasEffect {
  constructor(
    private engine: GraphEngine,
    public target: GraphObject & Spinwise,
    private start$ = engine.pointer.start$
  ) {}

  pulse(): Observable<any> {
    return this.start$.pipe(
      this.engine.pointer.filterPointWithContact(this.target),
      map(({ point }) => point),
      tap(() => this.engine.bringToTop(this.target)),
      map((_point) => this.target.spin),
      exhaustMap((init) =>
        this.engine.frame(this.target).pipe(
          // exhaustMap para evitar más de un proceso a la vez
          duration(500),
          map(easyGoing2),
          map(valuesBetween(init, init + Math.PI / 2)),
          tap((angle) => (this.target.spin = angle))
        )
      ),
      share()
    );
  }
}

export interface Elastic {
  elasticity: number;
}

export class ElasticEffect implements CanvasEffect {
  constructor(
    private frame$: Observable<number>,
    public target: Drawable & Elastic
  ) {}

  pulse(): Observable<any> {
    return this.frame$.pipe(
      map(radiansPerSecond(Math.PI / 4)),
      map((radians) => 1 + Math.cos(radians) / 2),
      tap((elasticity) => (this.target.elasticity = elasticity)),
      share()
    );
  }
}

export class PickUpEffect implements CanvasEffect {
  constructor(
    private engine: GraphEngine,
    public target: GraphObject & Elastic,
    private start$: Observable<Point> = engine.pointer.start$
  ) {}

  pulse(): Observable<any> {
    const pickupPoint$ = this.start$.pipe(
      this.engine.pointer.filterPointWithContact(this.target),
      map(({ point }) => point)
    );
    const pickupEnd$ = pickupPoint$.pipe(
      switchMap((_point) => this.engine.pointer.end$.pipe(first()))
    );
    return merge(
      // Fase crecimiento elasticidad (pick up)
      pickupPoint$.pipe(
        tap(() => this.engine.bringToTop(this.target)),
        switchMap((_point) =>
          this.engine.frame(this.target).pipe(
            duration(500),
            map(easyGoing2),
            map(valuesBetween(1, 1.5)),
            tap((elasticity) => (this.target.elasticity = elasticity)),
            takeUntil(this.engine.pointer.end$)
          )
        )
      ),
      // Fase retroceso elasticidad (drop down)
      pickupEnd$.pipe(
        // tap(() => console.log(`pickup end ${this.target.elasticity}`)),
        map((_point) => this.target.elasticity), // partimos de la elasticidad previa al end$
        switchMap((max) =>
          this.engine.frame(this.target).pipe(
            duration(500),
            map(easyGoing2),
            map(valuesBetween(max, 1)),
            tap((elasticity) => (this.target.elasticity = elasticity))
          )
        )
      )
    ).pipe(share());
  }
}

export class MovementEffect implements CanvasEffect {
  constructor(
    private engine: GraphEngine,
    public target: Drawable & Traceable,
    private start$ = engine.pointer.start$
  ) {}

  pulse(): Observable<any> {
    const frame$ = this.engine.frame(this.target); /// ?? this.engine.frame$;
    return this.start$.pipe(
      this.engine.pointer.filterPointWithoutContact(),
      map((point) => this.engine.pointInGraphLayer(point, this.target)), // coord transformation
      map((point) => [this.target.position, point] as [Point, Point]),
      switchMap(([origin, dest]: [Point, Point]) =>
        frame$.pipe(
          movement(origin, dest, 500, true),
          tap((point) => (this.target.position = point))
        )
      ),
      share()
    );
  }
}

// const attrContactIsNotNull = (x: { origin: Point, contact: Contact | null, point: Point }): x is { origin: Point, contact: Contact, point: Point } => x.contact !== null;
// const attrContactIsNotNull = <T extends { contact: Contact | null }>(x: T): x is T & { contact: Contact } => x.contact !== null;

export class DragEffect implements CanvasEffect {
  public readonly pulse$: Observable<any>;
  public readonly drop$: Observable<{
    origin: Point;
    contact: Contact;
    point: Point;
  }>;
  protected readonly drag$: Observable<{
    origin: Point;
    contact: Contact;
    point: Point;
  }>;

  constructor(protected engine: GraphEngine, public target: GraphObject) {
    this.drag$ = this.engine.pointer.drag$.pipe(
      // filter(({ origin, contact, point }) => contact !== null && contact.graph === this.target),
      // filter(attrContactIsNotNull), // filter(({ origin, contact, point }) => contact !== null),
      filter(
        <T extends { contact: Contact | null }>(
          x: T
        ): x is T & { contact: Contact } => x.contact !== null
      ),
      filter(
        ({ origin: _origin, contact, point: _point }) =>
          contact.graph === this.target
      ),
      map(({ origin, contact, point }) => ({
        origin: this.engine.pointInGraphLayer(origin, this.target),
        contact,
        point: {
          ...point,
          ...this.engine.pointInGraphLayer(point, this.target),
        },
      }))
    );
    this.pulse$ = this.drag$.pipe(
      map(({ contact, point }) => vector(contact.vector, point)),
      tap((position) => (this.target.position = position)),
      share()
    );
    this.drop$ = this.drag$.pipe(
      switchMap((drag) => this.engine.pointer.end$.pipe(take(1), mapTo(drag)))
    );
  }

  pulse(): Observable<any> {
    return this.pulse$;
  }
}

export class DragAndComeBackEffect implements CanvasEffect {
  public readonly pulse$: Observable<any>;

  constructor(private engine: GraphEngine, public target: GraphObject) {
    const dragEffect = new DragEffect(engine, target);
    const dropWithContact$ = dragEffect.drop$.pipe(
      switchMap((drop) =>
        this.engine.checkCollision(this.target).pipe(
          isEmpty(),
          filter((vacio) => !vacio),
          mapTo(drop)
        )
      )
    );
    const graphMove$ = dropWithContact$.pipe(
      map(({ origin, contact, point: _ }) => ({
        graph: target,
        dest: vector(contact.vector, origin),
      }))
    );
    const comeBackEffect = new MoveGraphEffect(engine, graphMove$);
    this.pulse$ = merge(dragEffect.pulse$, comeBackEffect.pulse$);
  }

  pulse(): Observable<any> {
    return this.pulse$;
  }
}

export interface Collidable {
  collision: boolean;
}

export class CollisionEffect implements CanvasEffect {
  constructor(
    private collision$: Observable<[GraphObject, GraphObject]>,
    public target: GraphObject & Collidable
  ) {}

  pulse(): Observable<any> {
    return this.collision$.pipe(
      filter(([g1, g2]) => g1 === this.target || g2 === this.target),
      tap((_) => (this.target.collision = true)),
      share()
    );
  }
}

export const collisionEffect =
  (collision$: Observable<[GraphObject, GraphObject]>) =>
  (graphic: GraphObject & Collidable) =>
    new CollisionEffect(collision$, graphic);
