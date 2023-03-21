# reactive-graphics

A minimal opinionated graphic engine based on rxjs.

[DRAFT DOCUMENT...]

**_Reactive Graphics_** is a typescript library for creating 2D graphics and animations using the [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API), with capabilities for interactions and collision detection. The library is strongly based on [Rxjs](https://github.com/ReactiveX/rxjs) (as its unique dependency) offering a variety of Rxjs operators to develop animations easily.

Another facility the library provides is _Modelling_, leveraging the Canvas API for building graphic blocks in a more declaratively way using compositions. Eventually every model is built as a collection of graphic paths. It benefits from using the efficient [Path2D](https://developer.mozilla.org/en-US/docs/Web/API/Path2D) as a result.

## Main features

### Graphics

- Using Canvas API directly
- Graphics modelling:
  - Composition
  - Geometric transformations
- Working with paths
  - Using PathBuilder
  - funcitonal paths
  - merge & join

### Animations

- Animations
- Effects
- Transitions

### Layers

- Control groups of graphics
- Layer features:
  - Geometric transformations
  - Visibility
  - Sensitivity

### Interaction

- Input devices
- Contacts
- Collisions

### Frame control

- Pace
- Pause/sleep

## Getting started

[PENDING DOCS...]

[installation]
CDN / npm

[showcase quick examples]

* Minimal example (rect/bezier/SVG Path) with & without reactive-graphics
* functional paths & join
* Composition
* Effects & interaction

[show incremental docs/code from one sample to the next. Full code of each sample through stackblitz.]::