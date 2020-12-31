import PolygonClipping from "polygon-clipping";

/**
 * Polygon represent a list of point that form a polygon.
 * A polygon is always closed.
 * The last point of the list wil be linked to the first.
 */
export default class Polygon {
  /**
   * Create a polygon
   * @param {Array<Object>} points Optionnal list of object with x and y attributes
   */
  constructor(points) {
    this._points = points;
  }

  /**
   * Create a polygon from a circle
   * @param {Object} centerPoint Object with x and y attribute
   * @param {Number} radius Radius of the circle to create in rad
   * @param {Number} steps Optionnal number of points to cut the circle into
   * @returns {Polygon} The circle polygon
   */
  static createCircle(centerPoint, radius, steps = 64) {
    const step = (2 * Math.PI) / steps;
    const points = [];
    for (let i = 0; i < steps; i++) {
      const theta = i * step;
      points.push({
        x: radius * Math.cos(theta) + centerPoint.x,
        y: radius * Math.sin(theta) + centerPoint.y,
      });
    }
    return new Polygon(points);
  }

  /**
   * Convert a new polygon from PolygonClipping format and output it
   * If it is a multi-polygon, only the first will be taken
   * @returns {Polygon} The new Polygon
   */
  static createFromPolygonClippingFormat(src) {
    const points = src[0][0].map((p) => ({ x: p[0], y: p[1] }));
    return new Polygon(points);
  }

  /**
   * Convert the polygon to PolygonClipping format and output it
   * @returns The polygon in PolygonClipping format
   */
  toPolygonClippingFormat() {
    const out = this.points.map((point) => [point.x, point.y]);
    out.push(out[0]);
    return [[out]];
  }

  /**
   * Create the union of multiple polygons and output a new polygon
   * @param  {...Polygon} polygons Polygon to merge
   * @returns {Polygon} The union of all given polygons
   */
  static union(...polygons) {
    const formated = polygons.map((polygon) =>
      polygon.toPolygonClippingFormat()
    );
    const out = PolygonClipping.union(...formated);
    return Polygon.createFromPolygonClippingFormat(out);
  }

  /**
   * Round buffer the current polygon and output a new one
   * @param  {Number} radius Radius of buffering
   * @returns {Polygon} The buffered polygon
   */
  buffer(radius) {
    const polygons = [];
    // Foreach point create a circle
    for (const point of this.points) {
      polygons.push(Polygon.createCircle(point, radius));
    }

    // Then for each edge, create a rectangle with the same angle and same length
    let p1 = this.points[this.points.length - 1];
    let dx, dy;
    for (const p2 of this.points) {
      if (p1.y != p2.y) {
        // Compute orthogonal directionnal coef
        const m = (p1.x - p2.x) / (p2.y - p1.y);

        // Compute the x and y distance to each point
        dx = radius / Math.sqrt(1 + m ** 2);
        dy = m * dx;
      } else {
        dx = 0;
        dy = radius;
      }

      // Create the four points
      const points = [
        { x: p1.x + dx, y: p1.y + dy },
        { x: p1.x - dx, y: p1.y - dy },
        { x: p2.x - dx, y: p2.y - dy },
        { x: p2.x + dx, y: p2.y + dy },
      ];
      polygons.push(new Polygon(points));
    }

    // Finally unionize everything
    return Polygon.union(...polygons);
  }

  /**
   * Point getter
   */
  get points() {
    return this._points;
  }
}
