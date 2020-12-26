import DataStore from "./DataStore.js";

/**
 * Parse the given 3D data json
 */
export default class DataParser {
  constructor() {
    this.data = new DataStore();
  }

  /**
   * Populate the datastore with the given json
   * @param {Object} json
   * @returns {DataStore} the populated datastore
   */
  parse(json) {
    console.log("raw json", json);

    // Parse global position offset first
    this.data.setOffset(json.head.x, json.head.y);

    // Parse layers and add it to our storage list
    for (const source of json.layers) {
      this.data.addLayer(this.parseLayer(source));
    }
    console.log("Layers", this.data.layers);

    // Parse shape list andd them to the list
    for (const shape of json.shape) {
      const split = shape.split("~");

      switch (split[0]) {
        case "TRACK":
          this.data.addShape(this.parseTrack(split));
          break;
        case "VIA":
          this.data.addShape(this.parseVia(split));
          break;
        case "PAD":
          this.data.addShape(this.parsePad(split));
          break;
        case "PAD":
          // Not implemented yet
          // console.log(out)
          break;
        case "COPPERAREA":
          // Not implemented yet
          // console.log(out)
          break;
        case "LIB":
          // Not implemented yet
          // console.log(out)
          break;
        case "ARC":
          this.data.addShape(this.parseArc(split));
          // console.log(out)
          break;
        case "RECT":
          // Not implemented yet
          // console.log(out)
          break;
        case "TEXT":
          // Not implemented yet
          // console.log(out)
          break;
        case "SOLIDREGION":
          // Not implemented yet
          // console.log(out)
          break;
        case "HOLE":
          // Not implemented yet
          // console.log(out)
          break;
        case "CIRCLE":
          // Not implemented yet
          // console.log(out)
          break;
        default:
          throw new Error(`Unknown shape type: ${split[0]}`);
      }
    }
    console.log("Shapes", this.data.shapes);

    return this.data;
  }

  //////////////////////////////////////////
  // Helper functions
  //////////////////////////////////////////

  /**
   * This function convert unit from the raw json to mm
   *
   * In the data json, unit are hundredth of an inch
   * And when we look at the interface, we cannot set more than 3 decimal digit
   */
  distToMM(value) {
    return Math.round(value * 0.254 * 1000) / 1000;
  }

  /**
   * Construct a 2D point object with raw coordinated that will be converted to mm and it will also remove offset
   * @param x The x raw coordinate
   * @param y The y raw coordinate
   */
  parsePoint(x, y) {
    return {
      x: this.distToMM(x - this.data.offset.x),
      y: this.distToMM(this.data.offset.y - y),
    };
  }

  //////////////////////////////////////////
  // Object parsing functions
  //////////////////////////////////////////

  /**
   * Parse a layer and return a layer object
   * @param source Source string that represent the layer
   * @returns Object that reprsesent a layer shape
   */
  parseLayer(source) {
    const split = source.split("~");

    // Some layer sources have 6 ~ and other 7. But it doesn't matter because when it's 7, the last argument is always empty anyway
    if (split.length !== 7 && split.length !== 8) {
      throw new TypeError(`Fail to parse the layer source: ${source}`);
    }

    const out = { type: "LAYER" };
    out.id = parseInt(split[0]);
    out.name = split[1];
    out.color = split[2];
    // Set by the visibility config in the 3D view
    out.visible = split[3] === "true";
    // Set by the pcb layer window. Not applied in the 3D view.
    out.pcbVisible = split[4] === "true";

    // Not reversed yet
    // split[5]: Boolean, seems to be true only on layer used in my case
    // split[6]: Number, can be empty, only applied to TopSolderMaskLayer and BottomSolderMaskLayer with the value of 0.3

    return out;
  }

  /**
   * Construct a Track
   * A track is a shape that is a muli-point line on a layer
   * @param split Splitted shape source string. The first element of the array should be 'TRACK'.
   * @returns Object that reprsesent a via track
   */
  parseTrack(split) {
    const out = { type: "TRACK" };

    // Check if the given split is valid
    if (split.length !== 7) {
      throw new TypeError(
        `Fail to parse the track shape. We were expecting an array of 7 items ; ${split.length} given`
      );
    }
    if (split[0] !== out.type) {
      throw new TypeError(
        `The splitted string doesn't represent a ${out.type}. Found type ${splittedString[0]}`
      );
    }

    // Unique string id
    out.id = split[5];

    // optional net at which out track is connected
    out.net = split[3] ? split[3] : null;

    // Tell if the element is locked in the pcb editor
    out.locked = split[6] === "1";

    // Layer ID
    out.layer = this.data.findLayerById(split[2]);

    // Width of the track in mm
    out.width = this.distToMM(split[1]);

    // Position of each point of the line
    out.points = [];
    const spaceSplit = split[4].split(" ");
    for (let i = 0; i < spaceSplit.length; i += 2) {
      out.points.push(this.parsePoint(spaceSplit[i], spaceSplit[i + 1]));
    }

    return out;
  }

  /**
   * Construct a Via
   * A via is a multi layer plated hole in the board that is conductor between layers
   * @param split Splitted shape source string. The first element of the array should be 'VIA'.
   * @returns Object that reprsesent a via shape
   */
  parseVia(split) {
    const out = { type: "VIA" };

    // Check if the given split is valid
    if (split.length !== 8) {
      throw new TypeError(
        `Fail to parse the via shape. We were expecting an array of 8 items ; ${split.length} given`
      );
    }
    if (split[0] !== out.type) {
      throw new TypeError(
        `The splitted string doesn't represent a ${out.type}. Found type ${splittedString[0]}`
      );
    }

    // Unique string id
    out.id = split[6];

    // optional net at which this track is connected
    out.net = split[4] ? split[4] : null;

    // Tell if the element is locked in the pcb editor
    out.locked = split[7] === "1";

    // Dimensions and position of the via
    out.center = this.parsePoint(split[1], split[2]);
    out.diameter = this.distToMM(split[3]);
    out.drillDiameter = this.distToMM(split[5] * 2);

    return out;
  }

  /**
   * Construct a Pad
   * A pad is an area where component will be soldered. It can contain a hole, plated or not.
   * @param split Splitted shape source string. The first element of the array should be 'PAD'.
   * @returns Object that reprsesent a via shape
   */
  parsePad(split) {
    const out = { type: "PAD" };
    // Check if the given split is valid
    if (split.length !== 20) {
      throw new TypeError(
        `Fail to parse the pad shape. We were expecting an array of 20 items ; ${split.length} given`
      );
    }
    if (split[0] !== out.type) {
      throw new TypeError(
        `The splitted string doesn't represent a ${out.type}. Found type ${splittedString[0]}`
      );
    }

    // Unique string id
    out.id = split[12];

    // optional net at which this track is connected
    out.net = split[7] ? split[7] : null;

    // Number typically used to assign a pad to a component pin
    // On a board, multiple pad can have the same "number"
    out.number = split[8] != "" ? parseInt(split[8]) : null;

    // Tell if the element is locked in the pcb editor
    out.locked = split[16] === "1";

    // Layer on which the pad is
    out.layer = this.data.findLayerById(split[6]);

    // If the hole is plated
    out.plated = split[15] == "Y";

    // Dimensions and position of the pad, rotation in degree
    out.shape = split[1];
    out.center = this.parsePoint(split[2], split[3]);
    out.width = this.distToMM(split[4]);
    out.height = this.distToMM(split[5]);
    out.rotation = Number(split[11]);

    // Hole diameter
    out.holeDiameter = this.distToMM(split[9] * 2);
    // Only used for slot hole. If round hole, holeLength will be 0
    out.holeLength = this.distToMM(split[13]);
    out.solderMaskExpansion = this.distToMM(split[18]);

    // Not reversed
    // out['polygonPointList'] = split[10].split(' ').map(v => this.distToMM(v))
    // out['14'] = split[19] !== '' ? split[14].split(' ').map(v => this.distToMM(v)) : null
    // out['17'] = split[17]
    // out['19'] = split[19] !== '' ? split[19].split(',').map(v => this.distToMM(v)) : null

    return out;
  }

  /**
   * Construct a Arc
   * An arc is a curved track
   * @param split Splitted shape source string. The first element of the array should be 'ARC'.
   */
  parseArc(split) {
    const out = { type: "ARC" };
    // Check if the given split is valid
    if (split.length !== 8) {
      throw new TypeError(
        `Fail to parse the arc shape. We were expecting an array of 8 items ; ${split.length} given`
      );
    }
    if (split[0] !== out.type) {
      throw new TypeError(
        `The splitted string doesn't represent a ${out.type}. Found type ${splittedString[0]}`
      );
    }

    // Unique string id
    out.id = split[6];

    // optional net at which this track is connected
    out.net = split[3] ? split[3] : null;

    // Tell if the element is locked in the pcb editor
    out.locked = split[6] === "1";

    // Layer on which the arc is
    out.layer = this.data.findLayerById(split[2]);

    // Width of the track in mm
    out.width = this.distToMM(split[1]);

    // Parse arc dimensions
    // There seems to be two format with the same content..
    //      M4120.3937,2995.374 A3.937,3.937 0 0 1 4124.3307,2999.311
    //      M 4241.5197 3524.5 A 7.0711 7.0711 0 1 1 4252.442 3531.3835
    const match = split[4].match(
      /^M ?([0-9\.]+)[, ]([0-9\.]+) A ?([0-9\.]+)[, ]([0-9\.]+) ([0-1]) ([0-1]) ([0-1]) ([0-9\.]+)[, ]([0-9\.]+)$/
    );
    if (!match) {
      throw new Error(`Fail to parse ARC dimensions ${split[4]}`);
    }
    out.points = [];
    // Start point
    out.points.push(this.parsePoint(match[1], match[2]));
    // End point
    out.points.push(this.parsePoint(match[8], match[9]));
    // Radius (doesn't seems to be possible to have an x!=y in easyeda UI)
    out.radiusX = this.distToMM(match[3]);
    out.radiusY = this.distToMM(match[3]);

    // Clocwise mode
    // match[6] and match[7] are both true in 'clockwise' mode, and both false in 'anticlockwise' mode
    out.rotationDirectionClockwise = match[6] === "1";

    // Not reversed
    // out['5'] = split[5]
    // out['4_7'] = match[7] === '1'
    // out['4_5'] = match[5] === '1'

    console.log(out, split);

    return out;
  }
}
