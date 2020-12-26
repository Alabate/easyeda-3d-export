import "https://cdnjs.cloudflare.com/ajax/libs/jsts/2.6.1/jsts.js";

/**
 * Processing functions applied to data parsed from json
 */

const OUTLINE_WIDTH = 0.3; // mm

/**
 * Extract the board outline and optional hole in board
 * @param {DataStore} data A populated datastore
 * @returns {Array} A list of polygons. The first is the board outline, any other are board holes
 */
export function getBoardOutlinePolygones(data) {
  // Find all BoardOutLine shapes
  const outlineShapes = data.findShapesByLayer(
    data.findLayerByName("BoardOutLine")
  );

  // For each element, create a geometry jsts object and use buffer to make it .3mm widtdh
  const geometryFactory = new jsts.geom.GeometryFactory();
  let polygons = [];
  for (const shape of outlineShapes) {
    if (shape.points && shape.points.length > 1) {
      if (shape.type === "TRACK") {
        const coords = shape.points.map(
          (p) => new jsts.geom.Coordinate(p.x, p.y)
        );
        let lineString = geometryFactory.createLineString(coords);

        // To try reproduce EasyEDA behaviour, the outline has always a width of 0.3mm
        polygons.push(lineString.buffer(OUTLINE_WIDTH / 2));
      } else if (shape.type === "ARC") {
        const coords = shape.points.map(
          (p) => new jsts.geom.Coordinate(p.x, p.y)
        );
        let lineString = geometryFactory.createLineString(coords);

        // const geometricShapeFactory = new jsts.util.GeometricShapeFactory();
        // geometricShapeFactory.setWidth(shape.radiusX * 2);
        // geometricShapeFactory.setHeight(shape.radiusY * 2);

        // // Find center
        // // source : http://mathforum.org/library/drmath/view/53027.html
        // const x0 =
        //   1 /
        //   (4 *
        //     shape.radiusX ** 2 *
        //     shape.radiusY ** 2 *
        //     (shape.points[0].y - shape.points[1].y));
        // const y0 =
        //   1 /
        //   (4 *
        //     shape.radiusX ** 2 *
        //     shape.radiusY ** 2 *
        //     (shape.points[0].x - shape.points[1].x));
        // geometricShapeFactory.setCentre({ x: x0, y: y0 });
        // let lineString = geometricShapeFactory.createArc(0, Math.PI / 2);

        // To try reproduce EasyEDA behaviour, the outline has always a width of 0.3mm
        polygons.push(lineString.buffer(OUTLINE_WIDTH / 2));
      } else {
        throw new Error(
          `Unepxected shape type in BoardOutLine layer ${shape.type}`
        );
      }
    }
  }

  console.log("All polygons", polygons);

  // Group polygons that intersects between them
  const groups = [];
  for (const polygon of polygons) {
    let matchGroup = null;
    // Iterate backward to be able to merge and delete groups
    for (let i = groups.length - 1; i >= 0; i--) {
      for (const testGeom of groups[i]) {
        if (polygon.intersects(testGeom)) {
          // On first match, copy a reference to this array
          // and stop iterating on this geom list
          if (matchGroup === null) {
            matchGroup = groups[i];
            matchGroup.push(polygon);
            break;
          }
          // On second match, append all geom to the first matching group
          // Then delete this group
          else {
            matchGroup.push(...groups[i]);
            groups.splice(i, 1);
          }
        }
      }
    }
    // If no match, we create a new group
    if (matchGroup === null) {
      groups.push([polygon]);
    }
  }

  console.log("Polygon groups", groups);

  // Merge groups that have more than one item
  const mergedPolygons = [];
  for (const group of groups) {
    if (group.length > 1) {
      const coll = new jsts.geom.GeometryCollection(group, geometryFactory);
      const union = new jsts.operation.union.UnaryUnionOp(coll);
      mergedPolygons.push(union.union());
    } else {
      mergedPolygons.push(group[0]);
    }
  }

  console.log("Merged Polygons", mergedPolygons);

  // The board outer border will be polygon with one internal area
  // that has the biggest bonding box area
  let borderPolygon = null;
  let maxArea = 0;
  for (const polygon of mergedPolygons) {
    if (polygon.getNumInteriorRing() == 1) {
      const area = polygon.getInteriorRingN(0).getEnvelope().getArea();
      if (area > maxArea) {
        borderPolygon = polygon;
        maxArea = area;
      }
    }
  }
  const border = borderPolygon.getInteriorRingN(0);
  console.log("Border", border);

  // Put every other polygons in the hole list
  const holes = [];
  for (const polygon of mergedPolygons) {
    if (polygon != borderPolygon) {
      holes.push(polygon.getExteriorRing());
    }
  }
  console.log("holes", holes);

  return { border, holes };
}
