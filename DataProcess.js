import "https://cdnjs.cloudflare.com/ajax/libs/jsts/2.6.1/jsts.js";

/**
 * Processing functions applied to data parsed from json
 */

const OUTLINE_WIDTH = 0.3; // mm

/**
 * Extract the board outline and optional hole in board
 * @param {DataStore} datastore A populated datastore
 * @returns {Array} A list of polygons. The first is the board outline, any other are board holes
 */
export function getBoardOutlinePolygones(datastore) {
  // Find all BoardOutLine shapes
  const outlineShapes = datastore.findShapesByLayer(
    datastore.findLayerIdByName("BoardOutLine")
  );

  // For each element, create a geometry jsts object and use buffer to make it .3mm widtdh
  const geometryFactory = new jsts.geom.GeometryFactory();
  let polygons = [];
  for (const shape of outlineShapes) {
    if (shape._type === "TRACK" || shape._type === "ARC") {
      const coords = shape.pointArr.map((p) => {
        const pmm = datastore.pointToMM(p);
        return new jsts.geom.Coordinate(pmm.x, pmm.y);
      });
      let lineString = geometryFactory.createLineString(coords);

      // To try reproduce EasyEDA behaviour, the outline has always a width of 0.3mm
      polygons.push(lineString.buffer(OUTLINE_WIDTH / 2));
    } else {
      console.warn(
        `Unepxected shape type in BoardOutLine layer ${shape._type}`,
        shape
      );
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

/**
 * Extract 3D shapes
 * @param {DataStore} datastore A populated datastore
 * @returns {Array} ?
 */
export function get3dShapes(datastore) {
  // Find all 3D shapes
  let shapes = datastore
    .findShapesByType("SVGNODE")
    .filter((s) => s.attrs.c_etype == "outline3D");

  for (const shape of shapes) {
    console.log("3D uuid", shape.attrs.uuid);
    // https://easyeda.com/analyzer/api/3dmodel/5c06dbf3f43040c4baada5acef156c93?_=1609172673948
  }

  console.log("3d shapes", shapes);
}
