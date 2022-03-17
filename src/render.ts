import {
  Subscription,
  Subject,
  Observable,
  interval,
  timer,
  range,
  of,
  from,
  fromEvent,
  merge,
  animationFrameScheduler,
  BehaviorSubject,
  EMPTY,
  share,
  filter,
  first,
  mapTo,
  map,
  defaultIfEmpty,
  isEmpty,
  mergeMap,
  switchMap,
  takeUntil,
  auditTime,
  bufferTime,
  tap,
  scan,
  withLatestFrom,
  distinctUntilChanged,
  toArray,
  take,
} from "rxjs";
import { Rect, Point, vector, squareDistance, Matrix, Identity } from "./geom";
import { differential, integration } from "./rx";

const CLICK_TIMEOUT = 300; // max time (ms) between start$ and end$ to be cosidered a click
const CLICK_EPSILON = 25; // cuadrado de la distantia máxima permitida de arrastre para considerarse click

// util to infer correct type when fintering an observable
const inputIsNotNull = <T>(value: T | null): value is T => value !== null;

export interface Drawable {
  draw(context: CanvasRenderingContext2D): void;
}

export interface Traceable {
  position: Point;
}

export interface GraphObject extends Drawable, Traceable {
  // getBoundingRect(): Rect; /// | null
  maybePointInGraph(matrix: Matrix, point: Point): boolean;
  isPointInGraph(context: CanvasDrawPath, point: Point): boolean; // point in device coords
  collisionDetectionPoints(): Point[]; // point coords? renombrar: checkPoints? contactPoints?
  // getBoundaries(): Rect[]; /// deprecated?
}

/**
 * An Effect makes changes to a graph target overtime.
 * The effect starts when it is played in the RenderManager (See RenderManager.playEffect()).
 * The effect could be stopped when the graph target is removed from the RenderManager.
 * If target is null, RenderManager will never stops the effect.
 */
export interface CanvasEffect {
  readonly target: Drawable | null;
  pulse(): Observable<any>; // Rendering request ticks
}

export type EffectFactory<T> = (t: T) => CanvasEffect;

class Layer<T extends Drawable> {
  protected geomMatrix: Matrix = Identity;
  protected inveMatrix: Matrix | null = Identity; // inveMatrix?
  protected graphics: T[] = [];
  protected graphMatrix: Map<T, Matrix> = new Map();

  addGraphic(graph: T) {
    this.graphics.push(graph);
    this.graphMatrix.set(graph, Identity);
  }

  removeGraphic(graph: T) {
    // Destructive version
    // const i = this.graphics.indexOf(graph);
    // if (i !== -1) this.graphics.splice(i, 1);
    // Immutable version
    this.graphics = this.graphics.filter((g) => g !== graph);
    this.graphMatrix.delete(graph);
  }

  bringToTop(graph: T) {
    this.graphics.push(
      ...this.graphics.splice(this.graphics.indexOf(graph), 1)
    );
  }

  sendToBack(graph: T) {
    this.graphics.unshift(
      ...this.graphics.splice(this.graphics.indexOf(graph), 1)
    );
  }

  scale(sx: number, sy: number) {
    this.geomMatrix = this.geomMatrix.scale(sx, sy);
    // this.inveMatrix = this.inveMatrix.scale(sx, sy, true);
    this.inveMatrix = null;
  }

  rotate(alpha: number) {
    this.geomMatrix = this.geomMatrix.rotate(alpha);
    // this.inveMatrix = this.inveMatrix.rotate(alpha, true);
    this.inveMatrix = null;
  }

  translate(point: Point) {
    this.geomMatrix = this.geomMatrix.translate(point);
    // this.inveMatrix = this.inveMatrix.translate(point, true);
    this.inveMatrix = null;
  }

  transformLayer(matrix: Matrix) {
    this.geomMatrix = this.geomMatrix.multiply(matrix);
    this.inveMatrix = null;
  }

  transform(point: Point): Point {
    return this.geomMatrix.transform(point);
  }

  inverseTransform(point: Point): Point {
    // return this.inveMatrix.transform(point);
    if (this.inveMatrix === null) {
      this.inveMatrix = this.geomMatrix.inverse();
    }
    return this.inveMatrix.transform(point);
  }

  get geomCoefficients(): [number, number, number, number, number, number] {
    return this.geomMatrix.coefficients;
  }

  set geomCoefficients([a, b, c, d, e, f]: [
    number,
    number,
    number,
    number,
    number,
    number
  ]) {
    this.geomMatrix.coefficients = [a, b, c, d, e, f];
    // this.inveMatrix = this.geomMatrix.inverse();
    this.inveMatrix = null;
  }

  setTransformGraph(graph: T, matrix: Matrix) {
    this.graphMatrix.set(graph, matrix);
  }

  transformGraph(graph: T, matrix: Matrix) {
    const gmatrix = this.graphMatrix.get(graph);
    if (!gmatrix) throw new Error("graph matrix not found");
    this.graphMatrix.set(graph, gmatrix.multiply(matrix));
  }

  renderObjects(context: CanvasRenderingContext2D) {
    context.save();
    const [a, b, c, d, e, f] = this.geomMatrix.coefficients;
    context.setTransform(a, b, c, d, e, f);
    this.graphics.forEach((graph) => {
      context.save();
      const gmatrix = this.graphMatrix.get(graph);
      if (gmatrix) context.transform(...gmatrix.coefficients);
      graph.draw(context);
      context.restore();
    });
    context.restore();
  }
}

class GraphStatus {
  public removed$: Observable<Drawable>;
  private removedSubject: Subject<Drawable> = new Subject<Drawable>();

  constructor() {
    this.removed$ = this.removedSubject.asObservable();
  }

  public removed(graph: Drawable) {
    this.removedSubject.next(graph);
  }
}

class PaceFrameAdapter {
  public readonly frame$: Observable<number>;
  private readonly paceSubject: BehaviorSubject<number> = new BehaviorSubject(
    1
  );

  constructor(sourceFrame: Observable<number>) {
    const pace$ = this.paceSubject.asObservable();
    this.frame$ = sourceFrame.pipe(
      differential(true),
      withLatestFrom(pace$),
      map(([delta, pace]) => delta * pace),
      integration(),
      distinctUntilChanged() // Para permitir pausa sin coste FPS
    );
  }

  pace(factor: number) {
    this.paceSubject.next(factor);
  }

  currentPace(): number {
    return this.paceSubject.value;
  }
}

class CanSleepFrameAdapter {
  public readonly frame$: Observable<number>;
  private readonly sleepSubject: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);

  constructor(sourceFrame: Observable<number>) {
    const sleep$ = this.sleepSubject.asObservable();
    this.frame$ = sourceFrame.pipe(
      withLatestFrom(sleep$),
      filter(([_frame, sleep]) => !sleep),
      map(([frame, _sleep]) => frame),
      share()
    );
  }

  sleep() {
    this.sleepSubject.next(true);
  }

  resume() {
    this.sleepSubject.next(false);
  }

  asleep(): boolean {
    return this.sleepSubject.getValue();
  }
}

class FrameManager {
  public readonly frame$: Observable<number>;
  private paceAdapter: PaceFrameAdapter;
  private pauseAdapter: PaceFrameAdapter;
  private sleepAdapter: CanSleepFrameAdapter;

  constructor(parentFrame: Observable<number> | null = null) {
    const originalFrame =
      parentFrame ??
      interval(0, animationFrameScheduler).pipe(
        map(() => animationFrameScheduler.now())
      );
    this.paceAdapter = new PaceFrameAdapter(originalFrame);
    this.pauseAdapter = new PaceFrameAdapter(this.paceAdapter.frame$);
    this.sleepAdapter = new CanSleepFrameAdapter(this.pauseAdapter.frame$);
    this.frame$ = this.sleepAdapter.frame$;
  }

  pace(factor: number) {
    this.paceAdapter.pace(factor);
  }

  currentPace(): number {
    return this.paceAdapter.currentPace();
  }

  pause() {
    this.pauseAdapter.pace(0);
  }

  paused(): boolean {
    return this.pauseAdapter.currentPace() === 0;
  }

  resume() {
    this.sleepAdapter.resume();
    this.pauseAdapter.pace(1);
  }

  sleep() {
    this.sleepAdapter.sleep();
  }

  asleep(): boolean {
    return this.sleepAdapter.asleep();
  }
}

interface Transformer {
  rotate(alpha: number): Transformer;
  scale(sx: number, xy: number): Transformer;
  translate(tx: number, ty: number): Transformer;
}

class LayerTransformer implements Transformer {
  constructor(private renderManager: RenderManager, private layer: number) {}

  rotate(alpha: number): Transformer {
    return this.transform(Identity.rotate(alpha));
  }

  scale(sx: number, sy: number): Transformer {
    return this.transform(Identity.scale(sx, sy));
  }

  translate(tx: number, ty: number): Transformer {
    return this.transform(Identity.translate({ x: tx, y: ty }));
  }

  private transform(matrix: Matrix): Transformer {
    this.renderManager.transformLayer(this.layer, matrix);
    return this;
  }
}
class GraphTransformer implements Transformer {
  constructor(private renderManager: RenderManager, private graph: Drawable) {}

  rotate(alpha: number): Transformer {
    return this.transform(Identity.rotate(alpha));
  }

  scale(sx: number, sy: number): Transformer {
    return this.transform(Identity.scale(sx, sy));
  }

  translate(tx: number, ty: number): Transformer {
    return this.transform(Identity.translate({ x: tx, y: ty }));
  }

  private transform(matrix: Matrix): Transformer {
    this.renderManager.transformGraph(this.graph, matrix);
    return this;
  }
}

export class RenderManager<L extends Layer<Drawable> = Layer<Drawable>> {
  public currentLayer: number;
  protected layerMap: Map<Drawable, number> = new Map();
  protected layers: L[];
  protected layerFrames: FrameManager[];

  public fps$: Observable<number>; // count of frames per second rendered. This value is updated every second.
  public status: GraphStatus = new GraphStatus();
  private readonly frameManager: FrameManager;
  private readonly effect$: Subject<CanvasEffect> = new Subject();
  private effectSub: Subscription | null = null;
  private fpsSubject?: Subject<number>;
  private pendingRenderRequests = 0;

  constructor(protected canvas: HTMLCanvasElement) {
    this.frameManager = new FrameManager();
    this.currentLayer = 0;
    this.layers = [this.newLayer()];
    this.layerFrames = [new FrameManager(this.frameManager.frame$)];
    this.fpsSubject = new Subject<number>();
    this.effectSub = this.effect$
      .pipe(
        mergeMap((effect) =>
          effect
            .pulse()
            .pipe(
              takeUntil(
                this.status.removed$.pipe(
                  filter((graph) => graph === effect.target)
                )
              )
            )
        ),
        auditTime(0, animationFrameScheduler) // throttleTime(0, animationFrame)
      )
      .subscribe(() => {
        this.renderPhase();
        this.fpsSubject?.next(1);
      });
    this.fps$ = this.fpsSubject.asObservable().pipe(
      bufferTime(1000),
      map((group) => group.length)
    );
  }

  get frame$() {
    return this.frameManager.frame$;
  }

  pace(factor: number) {
    this.frameManager.pace(factor);
  }

  currentPace(): number {
    return this.frameManager.currentPace();
  }

  pause() {
    this.frameManager.pause();
  }

  paused(): boolean {
    return this.frameManager.paused();
  }

  resume() {
    this.frameManager.resume();
  }

  sleep() {
    this.frameManager.sleep();
  }

  asleep(): boolean {
    return this.frameManager.asleep();
  }

  frame(graph: Drawable): Observable<number> {
    return this.layerFrames[this.layerOfGraph(graph)].frame$;
  }

  frameOfLayer(layer: number) {
    return this.layerFrames[layer].frame$;
  }

  protected newLayer(): L {
    return new Layer<Drawable>() as L;
  }

  /**
   * Release effect resources
   */
  destroy() {
    if (this.effectSub !== null) {
      this.effectSub.unsubscribe();
      this.effectSub = null;
      this.fpsSubject?.complete();
    }
  }

  public nextLayer(): number {
    this.layerFrames.push(new FrameManager(this.frameManager.frame$));
    return (this.currentLayer = this.layers.push(this.newLayer()) - 1);
  }

  public switchLayer(layer: number) {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    this.currentLayer = layer;
  }

  public enableLayer(layer: number) {
    this.layerFrames[layer].resume();
    this.requestRender();
  }

  public disableLayer(layer: number) {
    this.layerFrames[layer].pause();
    this.requestRender();
  }

  public layerEnabled(layer: number): boolean {
    return !this.layerFrames[layer].paused();
  }

  /**
   * Produce a new Effect.
   * This method cannot be invoked before init().
   */
  playEffect(effect: CanvasEffect) {
    if (this.effectSub === null) {
      throw new Error(
        "Invalid state: You Can't add any effect before initialization."
      );
    }
    this.effect$.next(effect);
  }

  addGraphic(
    graphOrDraw: Drawable | ((context: CanvasRenderingContext2D) => void),
    layer: number | null = null
  ): GraphContext<Drawable> {
    const graph =
      typeof graphOrDraw === "function" ? { draw: graphOrDraw } : graphOrDraw;
    // For robustness, we remove it first if graph already in engine
    if (this.layerMap.get(graph) !== undefined) {
      this.removeGraphic(graph);
    }
    const graphLayer = layer ?? this.currentLayer;
    this.layers[graphLayer].addGraphic(graph);
    this.layerMap.set(graph, graphLayer);
    this.requestRender();
    return new GraphContext(this, graph);
  }

  removeGraphic(graph: Drawable): number {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not remove unknown graph.`);
    }
    this.layers[layer].removeGraphic(graph);
    this.layerMap.delete(graph);
    this.status.removed(graph);
    return layer;
  }

  bringToTop(graph: Drawable) {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not bring to top unknown graph.`);
    }
    this.layers[layer].bringToTop(graph);
  }

  sendToBack(graph: Drawable) {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not send to back unknown graph.`);
    }
    this.layers[layer].sendToBack(graph);
  }

  // scaleLayer(sx: number, sy: number, layer: number | null = null) {
  //   layer = layer ?? this.currentLayer;
  //   if (layer < 0 || layer >= this.layers.length) {
  //     throw Error(`Invalid layer ${layer}.`);
  //   }
  //   this.layers[layer].scale(sx, sy);
  // }

  // scaleLayers(sx: number, sy: number, ...layers: number[]) {
  //   layers.forEach((layer) => this.scaleLayer(sx, sy, layer));
  // }

  // rotateLayer(alpha: number, layer: number | null = null) {
  //   layer = layer ?? this.currentLayer;
  //   if (layer < 0 || layer >= this.layers.length) {
  //     throw Error(`Invalid layer ${layer}.`);
  //   }
  //   this.layers[layer].rotate(alpha);
  // }

  // rotateLayers(alpha: number, ...layers: number[]) {
  //   layers.forEach((layer) => this.rotateLayer(alpha, layer));
  // }

  // translateLayer(point: Point, layer: number | null = null) {
  //   layer = layer ?? this.currentLayer;
  //   if (layer < 0 || layer >= this.layers.length) {
  //     throw Error(`Invalid layer ${layer}.`);
  //   }
  //   this.layers[layer].translate(point);
  // }

  // translateLayers(point: Point, ...layers: number[]) {
  //   layers.forEach((layer) => this.translateLayer(point, layer));
  // }

  setTransformLayer(layer: number, matrix: Matrix) {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    this.layers[layer].geomCoefficients = matrix.coefficients;
  }

  transformLayer(layer: number, matrix: Matrix) {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    this.layers[layer].transformLayer(matrix);
  }

  layerTransformer(layer: number | null = null): Transformer {
    const l = layer ?? this.currentLayer;
    return new LayerTransformer(this, l);
  }

  layerOfGraph(graph: Drawable): number {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not find graph layer.`);
    }
    return layer;
  }

  pointInLayer(point: Point, layer: number): Point {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    return this.layers[layer].inverseTransform(point);
  }

  pointFromLayer(point: Point, layer: number): Point {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    return this.layers[layer].transform(point);
  }

  pointInGraphLayer(point: Point, graph: Drawable): Point {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not find graph layer.`);
    }
    return this.layers[layer].inverseTransform(point);
  }

  pointFromGraphLayer(point: Point, graph: Drawable): Point {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not find graph layer.`);
    }
    return this.layers[layer].transform(point);
  }

  rectInLayer(rect: Rect, layer: number): Rect {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    return new Rect(
      this.layers[layer].inverseTransform(rect.from),
      this.layers[layer].inverseTransform(rect.to)
    );
  }

  rectFromLayer(rect: Rect, layer: number): Rect {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    return new Rect(
      this.layers[layer].transform(rect.from),
      this.layers[layer].transform(rect.to)
    );
  }

  rectInGraphLayer(rect: Rect, graph: Drawable): Rect {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not find graph layer.`);
    }
    return new Rect(
      this.layers[layer].inverseTransform(rect.from),
      this.layers[layer].inverseTransform(rect.to)
    );
  }

  rectFromGraphLayer(rect: Rect, graph: Drawable): Rect {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not find graph layer.`);
    }
    return new Rect(
      this.layers[layer].transform(rect.from),
      this.layers[layer].transform(rect.to)
    );
  }

  layerGeomCoefficients(
    layer: number
  ): [number, number, number, number, number, number] {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    return this.layers[layer].geomCoefficients;
  }

  setLayerGeomCoefficients(
    layer: number,
    [a, b, c, d, e, f]: [number, number, number, number, number, number]
  ) {
    if (layer < 0 || layer >= this.layers.length) {
      throw Error(`Invalid layer ${layer}.`);
    }
    this.layers[layer].geomCoefficients = [a, b, c, d, e, f];
  }

  setTransformGraph(graph: Drawable, matrix: Matrix) {
    const layer = this.layerOfGraph(graph);
    this.layers[layer].setTransformGraph(graph, matrix);
  }

  transformGraph(graph: Drawable, matrix: Matrix) {
    const layer = this.layerOfGraph(graph);
    this.layers[layer].transformGraph(graph, matrix);
  }

  graphTransformer(graph: Drawable): Transformer {
    return new GraphTransformer(this, graph);
  }

  public requestRender() {
    this.pendingRenderRequests++;
    if (this.pendingRenderRequests === 1) {
      requestAnimationFrame(() => {
        this.renderPhase();
        this.pendingRenderRequests = 0;
      });
    }
  }

  private renderPhase() {
    const context = this.canvas.getContext("2d");
    if (context !== null) {
      this.clearCanvas(context);
      this.renderObjects(context);
    }
  }

  private clearCanvas(context: CanvasRenderingContext2D) {
    context.fillStyle = "black";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderObjects(context: CanvasRenderingContext2D) {
    this.layers
      .map((layer, index) => ({ layer, enabled: this.layerEnabled(index) }))
      .filter(({ enabled }) => enabled)
      .map(({ layer }) => layer)
      .forEach((layer) => layer.renderObjects(context));
  }
}

export class GraphContext<T extends Drawable> {
  constructor(private renderManager: RenderManager, public graph: T) {}

  transform(matrix: Matrix): GraphContext<T> {
    this.renderManager.transformGraph(this.graph, matrix);
    return this;
  }

  effect(factory: EffectFactory<T>) {
    this.renderManager.playEffect(factory(this.graph));
  }

  effects(...factories: EffectFactory<T>[]) {
    factories.forEach((factory) => this.effect(factory));
  }
}

export interface Contact {
  graph: GraphObject;
  vector: Point;
}

interface LayeredContacts {
  layer: number;
  contacts: Observable<Contact>;
}

interface ContactDetection {
  checkContact(point: Point): Observable<Contact>;
  checkLayerContacts(point: Point): Observable<LayeredContacts>;
  checkContactAboveLayer(point: Point, layer: number): Observable<Contact>;
  // checkContactInLayer(point: Point, layer: number): Observable<Contact>;
  // checkContactFromLayer(point: Point, layer: number): Observable<Contact>;
}

interface CollisionDetection {
  checkCollision(graph: GraphObject): Observable<GraphObject>;
}

export class KeyboardInput {
  /// Pendiente
}

export class PointerInput {
  public readonly start$: Observable<Point>;
  public readonly move$: Observable<Point>;
  public readonly end$: Observable<Point>;
  public readonly click$: Observable<Point>;
  public readonly hold$: Observable<Point>;
  public readonly doubleClick$: Observable<Point>;
  public readonly oneClick$: Observable<Point>;
  public readonly drag$: Observable<{
    origin: Point;
    contact: Contact | null;
    point: Point;
  }>;
  private readonly enableInputSubject: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(true);

  constructor(canvas: HTMLCanvasElement, private detector: ContactDetection) {
    const inputEnabled = this.enableInputSubject.asObservable();
    this.start$ = merge(
      fromEvent<MouseEvent>(canvas, "mousedown").pipe(
        map((event: MouseEvent) => ({ x: event.offsetX, y: event.offsetY }))
      ),
      fromEvent<TouchEvent>(canvas, "touchstart").pipe(
        map((event: TouchEvent) => this.touchEventToPoint(event, canvas))
      )
    ).pipe(
      withLatestFrom(inputEnabled),
      filter(([_point, enabled]) => enabled),
      map(([point, _enabled]) => point)
    );
    this.move$ = merge(
      fromEvent<MouseEvent>(canvas, "mousemove").pipe(
        tap((event: MouseEvent) => event.preventDefault()),
        map((event: MouseEvent) => ({ x: event.offsetX, y: event.offsetY }))
      ),
      fromEvent<TouchEvent>(canvas, "touchmove").pipe(
        map((event: TouchEvent) => this.touchEventToPoint(event, canvas))
      )
    ).pipe(
      withLatestFrom(inputEnabled),
      filter(([_point, enabled]) => enabled),
      map(([point, _enabled]) => point)
    );
    this.end$ = merge(
      fromEvent<MouseEvent>(canvas, "mouseup").pipe(
        map((event: MouseEvent) => ({ x: event.offsetX, y: event.offsetY }))
      ),
      fromEvent<TouchEvent>(canvas, "touchend").pipe(
        map((event: TouchEvent) => this.touchEventToPoint(event, canvas))
      )
    ).pipe(
      withLatestFrom(inputEnabled),
      filter(([_point, enabled]) => enabled),
      map(([point, _enabled]) => point)
    );
    this.click$ = this.start$.pipe(
      switchMap((point: Point) =>
        merge(
          timer(CLICK_TIMEOUT).pipe(
            map(() => ({ timeout: true, init: point, end: null }))
          ),
          this.end$.pipe(
            map((endPoint) => ({ timeout: false, init: point, end: endPoint }))
          )
        ).pipe(first())
      ),
      filter(
        ({ timeout, init, end }) =>
          !timeout && squareDistance(init, end as Point) < CLICK_EPSILON
      ),
      map(({ timeout: _timeout, init, end: _end }) => init),
      share()
    );
    this.hold$ = this.start$.pipe(
      switchMap((point: Point) =>
        merge(
          timer(CLICK_TIMEOUT).pipe(mapTo(point)),
          this.end$.pipe(mapTo(null)),
          this.move$.pipe(
            map((movePoint) => squareDistance(point, movePoint)),
            filter((d2) => d2 > CLICK_EPSILON),
            mapTo(null),
            takeUntil(this.end$)
          )
        ).pipe(
          first(),
          // filter(p => p !== null),
          // map(p => p as Point) // One option to infer correct type
          filter(inputIsNotNull) // Better option to infer correct type
        )
      ),
      share()
    );

    this.doubleClick$ = this.click$.pipe(
      switchMap((_: Point) =>
        merge(timer(CLICK_TIMEOUT).pipe(mapTo(null)), this.end$).pipe(first())
      ),
      filter(inputIsNotNull), // so type is inferred, instead of filter(c => c !== null),
      share()
    );
    this.oneClick$ = this.click$.pipe(
      switchMap((point: Point) =>
        merge(
          timer(CLICK_TIMEOUT).pipe(mapTo([1, point] as [number, Point])),
          this.end$.pipe(map((point) => [2, point] as [number, Point]))
        ).pipe(first())
      ),
      // [tipo, point]
      // Hasta aquí, el oneClick queda identificado por un tipo 1, pero desgraciadamente
      // tras un tipo 2 también viene un tipo 1, en este caso este tipo 1 habría que descartarlo.
      // Para descartar los tipo 1 precedidos de un tipo 2, lo marcamos como 3 para descarlo.
      scan(
        ([accTipo, _accPoint], [tipo, point]) =>
          [accTipo === 2 && tipo === 1 ? 3 : tipo, point] as [number, Point]
      ),
      filter(([tipo, _point]: [number, Point]) => tipo === 1),
      map(([_tipo, point]: [number, Point]) => point),
      share()
    );
    this.drag$ = this.start$.pipe(
      switchMap((origin) =>
        of(origin).pipe(
          this.contact(),
          map((contact) => ({ origin, contact })),
          defaultIfEmpty({ origin, contact: null })
        )
      ),
      mergeMap(({ origin, contact }) =>
        this.move$.pipe(
          takeUntil(this.end$),
          map((point) => ({ origin, contact, point }))
        )
      ),
      share()
    );
    ///
    // const drop$ = this.start$.pipe(
    //   switchMap(origin => of(origin).pipe(
    //     this.contact(), // this.topContact(),
    //     map(contact => ({ origin, contact })),
    //     defaultIfEmpty({ origin, contact: null })
    //   )),
    //   mergeMap(({ origin, contact }) => this.move$.pipe(
    //     takeUntil(this.end$),
    //     map(point => ({ origin, contact, point })),
    //     last()
    //   )),
    //   share()
    // );
  }

  enablePointerEvents() {
    this.enableInputSubject.next(true);
  }

  disablePointerEvents() {
    this.enableInputSubject.next(false);
  }

  protected touchEventToPoint(
    event: TouchEvent,
    canvas: HTMLCanvasElement
  ): Point {
    event.preventDefault();
    const t = event.changedTouches.item(event.changedTouches.length - 1);
    const { left, top } = canvas.getBoundingClientRect();
    const tx = t?.clientX ?? left;
    const ty = t?.clientY ?? top;
    return { x: tx - left, y: ty - top };
  }

  // OPERADORES SOBRE POINTERS Y CONTACTOS: Filtrado de puntos

  /** Operador que dada una secuencia de puntos, filtra dejando solamente aquellos que no intersectan con ningún objeto */
  filterPointWithoutContact(): (
    source: Observable<Point>
  ) => Observable<Point> {
    return (source: Observable<Point>) => {
      return source.pipe(
        mergeMap((point) =>
          this.detector.checkContact(point).pipe(
            isEmpty(),
            filter((empty) => empty),
            mapTo(point)
          )
        )
      );
    };
  }

  /**
   * Operador que dada una secuencia de puntos, filtra dejando solamente aquellos que no intersectan con ningún objeto situado
   * en layers superiores al lado.
   */
  filterPointWithoutContactAboveLayer(
    layer: number
  ): (source: Observable<Point>) => Observable<Point> {
    return (source: Observable<Point>) => {
      return source.pipe(
        mergeMap((point) =>
          this.detector.checkContactAboveLayer(point, layer).pipe(
            isEmpty(),
            filter((empty) => empty),
            mapTo(point)
          )
        )
      );
    };
  }

  /** Operador que dada una secuencia de puntos, filtra dejando solamente aquellos que intersectan un objeto dado */
  filterPointWithContact(
    graph: GraphObject
  ): (
    source: Observable<Point>
  ) => Observable<{ point: Point; contact: Contact }> {
    return (source: Observable<Point>) =>
      source.pipe(
        this.pointContact(),
        filter(({ contact }) => contact.graph === graph)
      );
  }

  /**
   * Operador que dada una secuencia de puntos, filtra dejando solamente aquellos que intersectan con algún objeto.
   * Junto al punto, se devuelve información de los contactos
   */
  filterPointWithContacts(): (
    source: Observable<Point>
  ) => Observable<{ point: Point; contacts: Contact[] }> {
    return (source: Observable<Point>) => {
      return source.pipe(
        mergeMap((point) =>
          this.detector.checkContact(point).pipe(
            toArray(),
            filter((contacts) => contacts.length > 0),
            map((contacts) => ({ point, contacts }))
          )
        )
      );
    };
  }

  /**
   * Operador que dada una secuencia de puntos, filtra dejando solamente aquellos que intersectan con algún objeto.
   * Solo se considera el layer superior donde se encuentra el primer contacto.
   * Junto al punto, se devuelve información de los contactos
   */
  filterPointWithTopContacts(): (
    source: Observable<Point>
  ) => Observable<{ point: Point; contacts: Contact[] }> {
    return (source: Observable<Point>) => {
      return source.pipe(
        mergeMap((point) =>
          of(point).pipe(
            this.topContact(),
            toArray(),
            filter((contacts) => contacts.length > 0),
            map((contacts) => ({ point, contacts }))
          )
        )
      );
    };
  }

  // OPERADORES SOBRE POINTERS Y CONTACTOS: Transformacion a contactos

  contact(): (source: Observable<Point>) => Observable<Contact> {
    return (source: Observable<Point>) => {
      return source.pipe(
        mergeMap((point) => this.detector.checkContact(point))
      );
    };
  }

  pointContact(): (
    source: Observable<Point>
  ) => Observable<{ point: Point; contact: Contact }> {
    return (source: Observable<Point>) => {
      return source.pipe(
        mergeMap((point) =>
          this.detector
            .checkContact(point)
            .pipe(map((contact) => ({ point, contact })))
        )
      );
    };
  }

  topContact(): (source: Observable<Point>) => Observable<Contact> {
    return (source: Observable<Point>) => {
      return source.pipe(
        mergeMap((point) =>
          this.detector.checkLayerContacts(point).pipe(
            mergeMap(({ layer, contacts }) =>
              contacts.pipe(
                isEmpty(),
                filter((empty) => !empty),
                mapTo({ layer, contacts })
              )
            ),
            take(1),
            mergeMap(({ layer: _, contacts }) => contacts)
          )
        )
      );
    };
  }

  pointTopContact(): (
    source: Observable<Point>
  ) => Observable<{ point: Point; contact: Contact }> {
    return (source: Observable<Point>) => {
      return source.pipe(
        mergeMap((point) =>
          this.detector.checkLayerContacts(point).pipe(
            mergeMap(({ layer, contacts }) =>
              contacts.pipe(
                isEmpty(),
                filter((empty) => !empty),
                mapTo({ layer, contacts })
              )
            ),
            take(1),
            mergeMap(({ layer: _, contacts }) => contacts),
            map((contact) => ({ point, contact }))
          )
        )
      );
    };
  }
}

class CollisionLayer extends Layer<GraphObject> {
  private objects: GraphObject[] = [];

  addObject(graph: GraphObject) {
    this.objects.push(graph);
  }

  removeObject(graph: GraphObject) {
    this.objects = this.objects.filter((g) => g !== graph);
  }

  checkContact(point: Point): Observable<Contact> {
    // transforming point from device coordinates to (world) layer coordinates
    const layerPoint = this.inverseTransform(point);
    return this.checkCollisionPoint(layerPoint).pipe(
      map((graph) => ({
        graph,
        vector: vector(graph.position, layerPoint),
      }))
    );
  }

  checkCollision(graph: GraphObject): Observable<GraphObject> {
    const objects = this.objects;
    return range(0, objects.length).pipe(
      map((i) => objects[i]),
      filter((g) => g !== graph),
      mergeMap((g) =>
        this.collide(graph, g).pipe(
          filter((collide) => collide),
          mapTo(g)
        )
      )
    );
  }

  checkCollisions(): Observable<[GraphObject, GraphObject]> {
    // NOTA IMPORTANTE:
    // Evitamos usar this.objects dentro de los operadores para asegurar DENTRO del flujo
    // que el array es inmutable (por si se elimina objeto en respuesta a colisión):
    const objects = this.objects;
    const n = this.objects.length;

    return range(0, n).pipe(
      mergeMap((i) => range(0, i).pipe(map((j) => [i, j]))),
      // sería necesario filtrar (por si se elimina objeto en respuesta a colisión) si hubiéramos
      // usado this.objects
      // filter(([i, j]) => i < this.objects.length && j < this.objects.length),
      map(([i, j]) => [objects[i], objects[j]] as [GraphObject, GraphObject]),
      mergeMap(([g1, g2]) =>
        this.collide(g1, g2).pipe(
          filter((collide) => collide),
          mapTo([g1, g2] as [GraphObject, GraphObject])
        )
      )
    );
  }

  // check graph collisions with the given point (in layer coord.)
  private checkCollisionPoint(point: Point): Observable<GraphObject> {
    return from(this.objects).pipe(
      // Evitamos usar coordenadas del dispositivo (this.geomMatrix.multiply(gmatrix)
      // por motivos de eficiencia ya que todos los objetos pertenecen al mismo layer
      map((graph) => ({
        graph,
        matrix: this.graphMatrix.get(graph) ?? Identity,
      })),
      // PHASE I: fast-easy preliminary filtering
      // filter(({ graph }) => graph.getBoundingRect().inside(point)),
      filter(({ graph, matrix }) => graph.maybePointInGraph(matrix, point)),
      // PHASE II: fine-grain filtering
      filter(({ graph, matrix }) => {
        const offContext = this.matrix2context(matrix);
        if (!offContext) return false;
        return graph.isPointInGraph(offContext, point);
      }),
      map(({ graph }) => graph)
    );
  }

  private collide(
    graph1: GraphObject,
    graph2: GraphObject
  ): Observable<boolean> {
    const matrix1 = this.graphMatrix.get(graph1) ?? Identity;
    const matrix2 = this.graphMatrix.get(graph2) ?? Identity;
    const source1 = from(graph1.collisionDetectionPoints()).pipe(
      map((point) => ({ point, matrix: matrix2, graph: graph2 }))
    );
    const source2 = from(graph2.collisionDetectionPoints()).pipe(
      map((point) => ({ point, matrix: matrix1, graph: graph1 }))
    );
    return merge(source1, source2).pipe(
      // PHASE I: fast-easy preliminary filtering
      filter(({ point, matrix, graph }) =>
        graph.maybePointInGraph(matrix, point)
      ),
      // PHASE II: fine-grain filtering
      filter(({ point, matrix, graph }) => {
        const offContext = this.matrix2context(matrix);
        if (!offContext) return false;
        return graph.isPointInGraph(offContext, point);
      }),
      isEmpty()
    );
  }

  private matrix2context(
    matrix: Matrix
  ): OffscreenCanvasRenderingContext2D | null {
    const offCanvas = new OffscreenCanvas(1, 1);
    const offContext = offCanvas.getContext("2d");
    offContext?.setTransform(...matrix.coefficients);
    return offContext;
  }
}

export class GraphEngine
  extends RenderManager<CollisionLayer>
  implements ContactDetection, CollisionDetection
{
  public readonly pointer: PointerInput;
  public readonly collision$: Observable<[GraphObject, GraphObject]>;

  constructor(public readonly canvas: HTMLCanvasElement) {
    super(canvas);
    this.pointer = new PointerInput(this.canvas, this);
    this.collision$ = this.frame$.pipe(
      // auditTime(100) o throttleTime(1000), // Para dar tiempo y poder tracear detección de colisiones
      /// switchMap(frametime => this.cd.checkCollisions()),
      switchMap((_frametime) =>
        from(this.layers).pipe(
          mergeMap((layer) => layer.checkCollisions()) /// pendiente devolver info de layer en colisiones
        )
      ),
      share()
    );
  }

  protected newLayer(): CollisionLayer {
    return new CollisionLayer();
  }

  public nextLayer(): number {
    return super.nextLayer();
  }

  addObject(
    graph: GraphObject,
    layer: number | null = null
  ): GraphContext<Drawable> {
    // For robustness, we remove it first if graph already in engine
    if (this.layerMap.get(graph) !== undefined) {
      this.removeObject(graph);
    }
    const graphLayer = layer ?? this.currentLayer;
    const context = super.addGraphic(graph, graphLayer);
    this.layers[graphLayer].addObject(graph);
    return context;
  }

  // redefinición para evitar que un cliente por error añada como objeto y elimine como gráfico
  // (dejando intacto la lista de boundaries)
  // removeGraphic(graph: GraphObject): number {
  //   return this.removeObject(graph);
  // }

  removeObject(graph: GraphObject): number {
    const layer = super.removeGraphic(graph);
    this.layers[layer].removeObject(graph);
    return layer;
  }

  checkContact(point: Point): Observable<Contact> {
    const activeLayers = this.layers
      .map((layer, index) => ({ layer, enabled: this.layerEnabled(index) }))
      .filter(({ enabled }) => enabled)
      .map(({ layer }) => layer);
    return from(activeLayers).pipe(
      mergeMap((layer) => layer.checkContact(point))
    );
  }

  checkContactInLayer(point: Point, layer: number): Observable<Contact> {
    return this.layerEnabled(layer)
      ? this.layers[layer].checkContact(point)
      : EMPTY;
  }

  checkContactAboveLayer(point: Point, layer: number): Observable<Contact> {
    const layerPairs = this.layers.map((layer, index) => ({
      layer,
      enabled: this.layerEnabled(index),
    }));
    return from(layerPairs.slice(layer + 1)).pipe(
      filter(({ layer: _, enabled }) => enabled),
      map(({ layer, enabled: _ }) => layer),
      mergeMap((layer) => layer.checkContact(point))
    );
  }

  checkLayerContacts(point: Point): Observable<LayeredContacts> {
    return range(0, this.layers.length).pipe(
      map((layerIndex) => ({
        layer: layerIndex,
        contacts: this.checkContactInLayer(point, layerIndex),
      }))
    );
  }

  checkCollision(graph: GraphObject): Observable<GraphObject> {
    const layer = this.layerMap.get(graph);
    if (layer === undefined) {
      throw Error(`Can not find unknown graph.`);
    }
    return this.layers[layer].checkCollision(graph);
  }
}
