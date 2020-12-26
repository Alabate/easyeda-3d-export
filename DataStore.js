/**
 * Store an manipulate data parsed from the raw json
 */
class DataStore {
  constructor() {
    /**
     * Every positions in the raw json have an offset. This is the offset in hundredth of inch.
     */
    this._offset = null;

    /**
     * List of layers from the json
     */
    this._layers = null;

    /**
     * List of shapes from the json
     */
    this._shapes = null;
  }

  /**
   * Offset setter
   */
  setOffset(x, y) {
    x = Number.parseFloat(x);
    y = Number.parseFloat(y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new TypeError(
        `X and Y are expected to be finite numbers. Got ${x} (${typeof x}) and ${y} (${typeof y})`
      );
    }
    this._offset = { x, y };
  }

  /**
   * Offset getter
   */
  get offset() {
    if (this._offset === null) {
      throw new Error("Offset has not been defined yet");
    }
    return this._offset;
  }

  /**
   * Add a layer to the list
   */
  addLayer(layer) {
    if (this._layers === null) {
      this._layers = [];
    }
    if (typeof layer !== "object") {
      throw new TypeError(`Expected an object ${typeof layer} given`);
    }
    this._layers.push(layer);
  }

  /**
   * layers getter
   */
  get layers() {
    if (this._layers === null) {
      throw new Error("Layers have not been defined yet");
    }
    return this._layers;
  }

  /**
   * Add a shape to the list
   */
  addShape(shape) {
    if (this._shapes === null) {
      this._shapes = [];
    }
    if (typeof shape !== "object") {
      throw new TypeError(`Expected an object ${typeof shape} given`);
    }
    this._shapes.push(shape);
  }

  /**
   * shapes getter
   */
  get shapes() {
    if (this._shapes === null) {
      throw new Error("Shapes have not been defined yet");
    }
    return this._shapes;
  }

  /**
   * Find layer by id in the layer list
   * @param id Integer ID of the layer
   * @returns Layer the found layer or null
   */
  findLayerById(id) {
    id = parseInt(id);
    for (const layer of this.layers) {
      if (layer.id == id) {
        return layer;
      }
    }
    return null;
  }

  /**
   * Find layer by name in the layer list
   * @param name Name of the layer to find
   * @returns Layer the found layer or null
   */
  findLayerByName(name) {
    for (const layer of this.layers) {
      if (layer.name == name) {
        return layer;
      }
    }
    return null;
  }

  /**
   * Find shapes that are on the given layer
   * @param {Layer} layer The layer that will be looked for
   * @returns a list of shape or an empty array
   */
  findShapesByLayer(layer) {
    const shapeList = [];
    for (const shape of this.shapes) {
      if (shape.layer && shape.layer.id === layer.id) {
        shapeList.push(shape);
      }
    }
    return shapeList;
  }
}

export default DataStore;
