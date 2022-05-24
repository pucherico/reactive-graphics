import { translationMatrix } from "../../geom";
import { Modeler } from "../../modeler/modeler";

export const mesa = Modeler.new()
  .include(
    Modeler.new()
      .fillStyle("violet")
      .newClosedPath()
      .point(0, 0)
      .horizontal(200)
      .vertical(200)
      .horizontal(150)
      .increment(-50, -300, true)
      .increment(-50, 300)
      .horizontal(0)
      // .vertical(-200)
      .fill(),
    translationMatrix({ x: -100, y: -100 })
  )
  .fillStyle("deeppink")
  .newClosedPath()
  .point(-4, -4)
  .horizontal(4)
  .vertical(4)
  .horizontal(-4)
  .fill()
  .build();
