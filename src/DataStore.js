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
  "SVGNODE",
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

    console.log("layers", this._data.layers);

    /**
     * List of shapes computed from data
     * We also inject `_index`, '_footprint_gid' and `_type` in their objects
     */
    this._shapes = null;
  }

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
   * Flatten _data object into a shape list. Also recurse on footprint shapes.
   * Also inject their types in the `_type` attribute, footprint gid in `_footprint_gid` and the index in the `_index` attribute.
   * @param {Object} data _data or footprint object
   * @param {Array} current_list The current list of extracted shape
   * @param {String} footprint_gid Optional parent footprint gid
   */
  _get_shape_list(data, current_list = [], footprint_gid = null) {
    let shapes = current_list;
    // Start to add main level shapes
    for (const type of SHAPE_TYPES) {
      if (data[type] !== undefined) {
        for (const [index, shape] of Object.entries(data[type])) {
          shape["_index"] = index;
          shape["_type"] = type;
          shape["_footprint_gid"] = footprint_gid;
          shapes.push(shape);
          if (type == "FOOTPRINT") {
            shapes = this._get_shape_list(shape, shapes, shape.head.gId);
          }
        }
      }
    }
    return shapes;
  }

  /**
   * Get a list of shape with their types in the `_type` attribute, and the index in the `_index` attribute.
   */
  get shapes() {
    if (this._shapes === null) {
      this._shapes = this._get_shape_list(this._data);
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
   * Find shapes that are of the given type
   * @param {String|Array} types The type of the shape wanted. Il multiple types are given, it will match any of them.
   * @returns a list of shape or an empty array
   */
  findShapesByType(types) {
    if (!(types instanceof Array)) {
      types = [types];
    }
    return this.shapes.filter((s) => types.includes(s._type));
  }

  /**
   * Find shape by gId
   * @param {String} gId The gId of the shape
   * @returns The shape or throw exception if not found
   */
  findShapeByGid(gId) {
    const found = this.shapes.find(
      (s) => s.gId == gId || (s.head && s.head.gId == gId)
    );
    if (!found) {
      throw new Error(`Shape with gId ${gId} not found`);
    }
    return found;
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
window.extension3dExporterDataStore = DataStore;
