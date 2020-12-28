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

        let lineString;
        try {
          // Only support circles
          if (shape.radiusX != shape.radiusY) {
            throw new Error(
              "Ellipsis arcs not supported. Only circle arcs are."
            );
          }

          // Doc to find position of center from points and radius
          // https://www.overleaf.com/read/stpqdczjqsdz

          // Set initial values
          const r = shape.radiusX;
          const x1 = shape.points[0].x;
          const y1 = shape.points[0].y;
          const x2 = shape.points[1].x;
          const y2 = shape.points[1].y;

          // Set intermediate values
          // Dist between P1 and P2
          const dist_p1_p2 = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          // Unit vector of the line that pass by both circle centers (M line)
          const mx = (y1 - y2) / dist_p1_p2;
          const my = (x2 - x1) / dist_p1_p2;
          // P3, Point on the M line, and in the middle of P1 and P2
          const x3 = (x1 + x2) / 2;
          const y3 = (y1 + y2) / 2;

          // Dist between P3 and circle center C1
          let tmp = r ** 2 - (x3 - x1) ** 2 - (y3 - y1) ** 2;
          // When P3 = C1 = C2, tmp might be equal to a very small negative value like -7.105427357601002e-15
          // Which will cause a NaN once we applied sqrt to it
          // This is probably because of floating point approx
          // So we ignore values under nanometer
          const epsilon = 10 ** -6;
          if (Math.abs(tmp) < epsilon) {
            tmp = 0;
          }
          const dist_p3_c = Math.sqrt(tmp);

          // Computer circle center
          let cx, cy;
          if (
            (shape.clockwise && shape.solution_selection) ||
            (!shape.clockwise && !shape.solution_selection)
          ) {
            cx = x3 + dist_p3_c * mx;
            cy = y3 + dist_p3_c * my;
          } else {
            cx = x3 - dist_p3_c * mx;
            cy = y3 - dist_p3_c * my;
          }

          // Compute arc begin and end in polar coordinates
          let theta1 = Math.atan2(y2 - cy, x2 - cx);
          let theta2 = Math.atan2(y1 - cy, x1 - cx);

          // If not clockwise, make it clockwise
          if (!shape.clockwise) {
            [theta1, theta2] = [theta2, theta1];
          }

          // Compute angle size in rad
          while (theta2 < theta1) {
            theta2 += 2 * Math.PI;
          }
          const angleSize = (theta2 - theta1) % (2 * Math.PI);

          // Create the shape
          const geometricShapeFactory = new jsts.util.GeometricShapeFactory();
          geometricShapeFactory.setWidth(r * 2);
          geometricShapeFactory.setHeight(r * 2);
          geometricShapeFactory.setCentre({ x: cx, y: cy });
          lineString = geometricShapeFactory.createArc(theta1, angleSize);
        } catch (error) {
          // On any error, fallback to a simple line
          console.warn("Fail to draw arc", error, shape);
          lineString = geometryFactory.createLineString(coords);
        }

        // To try reproduce EasyEDA behaviour, the outline has always a width of 0.3mm
        polygons.push(lineString.buffer(OUTLINE_WIDTH / 2));
      } else {
        throw new Error(
          `Unepxected shape type in BoardOutLine layer ${shape.type}`
        );
      }
    }
  }

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

  // Put every other polygons in the hole list
  const holes = [];
  for (const polygon of mergedPolygons) {
    if (polygon != borderPolygon) {
      holes.push(polygon.getExteriorRing());
    }
  }

  return { border, holes };
}
