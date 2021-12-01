import { Observable, interval, zip, every, map, concatMap, first, startWith, scan, skip } from 'rxjs';
// import { map, every, scan, skip, concatMap, first, startWith } from 'rxjs/operators';

/// Mejorar este operador usando filter + isEmpty
export const some = <T>(predicate: (n: T) => boolean) =>
    (source: Observable<T>) =>
      source.pipe(
        every((n: T) => !predicate(n)),
        map(value => !value)
      );

/// Posible mejora, analizar y sustituirlo por el anterior (y exportarlo)
// const someMejorado = <T>(predicate: (n: T) => boolean) =>
//     (source: Observable<T>) =>
//       source.pipe(
//         filter((n: T) => predicate(n)),
//         isEmpty(),
//         map(empty => !empty)
//       );

export const timespan = (delay: number) => <T>(source: Observable<T>) => {
  const tick$ = source.pipe(
      concatMap(_ => interval(delay).pipe(first())),
      startWith(null)
  );
  return zip(source, tick$, (s, _) => s);
};

export const differential = (relative = false) => (source: Observable<number>) => {
  const diff = source.pipe(
    scan((pair, next) => ({ value: next, delta: next - pair.value }), { value: 0, delta: 0 }),
    map(({ delta }) => delta)
  );
  return relative ? diff.pipe(skip(1)) : diff;
}

export const integration = () => (source: Observable<number>) =>
  source.pipe(scan((acc, delta) => acc + delta));