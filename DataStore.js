const SHAPE_TYPES = [
  "COPPERAREA",
  "TRACK",
  "PAD",
  "VIA",
  "TEXT",
  "FOOTPRINT",
  "ARC",
  "RECT",
  "CIRCLE",
  "SOLIDREGION",
  "HOLE",
];

/**
 * Store an manipulate data from file source
 */
class DataStore {
  constructor(data) {
    /**
     * The raw big data object
     */
    this._data = data;
    /**
     * Every positions in the raw json have an offset. This is the offset in hundredth of inch.
     */
    // this._offset = null;

    // /**
    //  * List of layers from the json
    //  */
    // this._layers = null;

    /**
     * List of shapes computed from data
     * We also inject `_index` and `_type` in their objects
     */
    this._shapes = null;
  }

  /**
   * Offset setter
   */
  // setOffset(x, y) {
  //   x = Number.parseFloat(x);
  //   y = Number.parseFloat(y);
  //   if (!Number.isFinite(x) || !Number.isFinite(y)) {
  //     throw new TypeError(
  //       `X and Y are expected to be finite numbers. Got ${x} (${typeof x}) and ${y} (${typeof y})`
  //     );
  //   }
  //   this._offset = { x, y };
  // }

  /**
   * Offset getter
   */
  get offset() {
    return {
      x: this._data.head.x,
      y: this._data.head.y,
    };
  }

  /**
   * Get a list of shape with their types in the `_type` attribute, and the index in the `_index` attribute.
   */
  get shapes() {
    if (this._shapes === null) {
      this._shapes = [];
      for (const type of SHAPE_TYPES) {
        for (const [index, shape] of Object.entries(this._data[type])) {
          shape["_index"] = index;
          shape["_type"] = type;
          this._shapes.push(shape);
        }
      }
    }
    return this._shapes;
  }

  /**
   * Find layer object by id in the layer list
   * @param id Integer ID of the layer
   * @returns The layer object found
   */
  findLayerById(id) {
    id = String(id);
    if (this._data.layers[id] !== undefined) {
      return this._data.layers[id];
    }
    throw new Error(`Layer '${id}' not found.`);
  }

  /**
   * Find layer id by name in the layer list
   * @param name Name of the layer to find
   * @returns The layer id found
   */
  findLayerIdByName(name) {
    console.log(this._data.layers);
    for (const [id, layer] of Object.entries(this._data.layers)) {
      if (layer.name == name) {
        return id;
      }
    }
    throw new Error(`Layer '${name}' not found.`);
  }

  /**
   * Find shapes that are on the given layer
   * @param {Number} layerId The layer id that will be looked for
   * @returns a list of shape or an empty array
   */
  findShapesByLayer(layerId) {
    return this.shapes.filter((s) => s.layerid == layerId);
  }

  /**
   * This function convert unit from the datastore to mm
   *
   * In the datastore, unit are hundredth of an inch
   * And when we look at the interface, we cannot set more than 3 decimal digit
   */
  distToMM(value) {
    return Math.round(value * 0.254 * 1000) / 1000;
  }

  /**
   * Output a a 2D point object with coordinated converted to mm and without offset
   * @param point An object with an x and y coordinate
   * @return An object with an x and y coordinate
   */
  pointToMM(point) {
    return {
      x: this.distToMM(point.x - this.offset.x),
      y: this.distToMM(this.offset.y - point.y),
    };
  }
}

export default DataStore;
