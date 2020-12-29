/**
 * Processing functions applied to data parsed from json
 */

const OUTLINE_WIDTH = 0.3; // mm
const BOARD_THICKNESS = 1.6; // mm
const DOWNLOAD_3D_URI = "/proxy/analyzer/api/3dmodel/";

/**
 * Use DataStore to create 3D objects that represent a PCB
 */
class Pcb3D {
  /**
   *
   * @param {DataStore} datastore Datastore that contain PCB sources
   */
  constructor(datastore) {
    this._ds = datastore;

    /** Cache for some functions that we call multiple times */
    this._borderPolygon = null;
    this._borderHolePolygons = null;
  }

  /**
   * Add all the 3d objects that represent the PCB
   * @param {THREE.Scene} scene The schene where to add the board
   */
  async addToScene(scene) {
    scene.add(this._getPcbBoardMesh());
    const component3dObjects = await this._getComponents3dObjects();
    for (const object of component3dObjects) {
      scene.add(object);
    }
  }

  getPcbBoardCentroid() {
    const [border, borderHoles] = this._getPcbBorderPolygons();
    return border.getEnvelope().getCentroid();
  }

  /**
   * Create a mesh of the PCB board (without component) with holes from drill and border layer
   * @returns {THREE.Mesh} The mesh of the PCB board
   */
  _getPcbBoardMesh() {
    // Get all the 3D objects that we need
    const [border, borderHoles] = this._getPcbBorderPolygons();
    const drillHoles = this._getHoles();
    const holes = [...borderHoles, ...drillHoles];

    // Create the board shape
    const boardShape = new THREE.Shape(
      border.getCoordinates().map((p) => new THREE.Vector2(p.x, p.y))
    );

    // Add holes
    for (const hole of holes) {
      const vectorList = hole
        .getCoordinates()
        .map((p) => new THREE.Vector2(p.x, p.y));
      boardShape.holes.push(new THREE.Path(vectorList));
    }

    // Extrude it
    const boardGeometry = new THREE.ExtrudeGeometry(boardShape, {
      depth: BOARD_THICKNESS,
      bevelEnabled: false,
    });

    // Add materials
    var boardMaterial = new THREE.MeshFaceMaterial([
      // blue surface top and bottom
      new THREE.MeshPhysicalMaterial({ color: 0x092559 }),
      // yellowish borders
      new THREE.MeshBasicMaterial({ color: 0xafaf68 }),
    ]);

    return new THREE.Mesh(boardGeometry, boardMaterial);
  }

  /**
   * Get pcb board border and holes polygons from the BorderOutLine layer
   * @returns {Array<Array<Polygons>>} Two lists of polygons in a list.
   * The first is the board outline, any other are board holes found from border outline.
   */
  _getPcbBorderPolygons() {
    // Compute only if needed
    if (this._borderPolygon !== null && this._borderHolePolygons !== null) {
      return [this._borderPolygon, this._borderHolePolygons];
    }

    // Find all BoardOutLine shapes
    const outlineShapes = this._ds.findShapesByLayer(
      this._ds.findLayerIdByName("BoardOutLine")
    );

    // For each element, create a geometry jsts object and use buffer to make it .3mm widtdh
    const geometricShapeFactory = new jsts.util.GeometricShapeFactory();
    const geometryFactory = new jsts.geom.GeometryFactory();
    let polygons = [];
    for (const shape of outlineShapes) {
      if (shape._type === "TRACK" || shape._type === "ARC") {
        const coords = shape.pointArr.map((p) => {
          const pmm = this._ds.pointToMM(p);
          return new jsts.geom.Coordinate(pmm.x, pmm.y);
        });
        let lineString = geometryFactory.createLineString(coords);
        polygons.push(lineString.buffer(OUTLINE_WIDTH / 2));
      } else if (shape._type === "CIRCLE") {
        geometricShapeFactory.setSize(this._ds.distToMM(shape.r) * 2);
        geometricShapeFactory.setCentre(
          this._ds.pointToMM({ x: shape.cx, y: shape.cy })
        );
        const polygon = geometricShapeFactory
          .createCircle()
          .buffer(OUTLINE_WIDTH / 2);
        polygons.push(polygon);
      } else {
        console.error(
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
    const borderHoles = [];
    for (const polygon of mergedPolygons) {
      if (polygon != borderPolygon) {
        borderHoles.push(polygon.getExteriorRing());
      }
    }

    [this._borderPolygon, this._borderHolePolygons] = [border, borderHoles];
    return [border, borderHoles];
  }

  /**
   * Extract holes of HOLe,VIA and PAD layers from datastore
   * @returns {Array} A list of polygons that are holes
   */
  _getHoles() {
    const holes = [];
    const geometricShapeFactory = new jsts.util.GeometricShapeFactory();
    const geometryFactory = new jsts.geom.GeometryFactory();

    // For HOLE and VIA, attributes that we use are the same
    const holeShapes = this._ds.findShapesByType(["HOLE", "VIA"]);
    for (const shape of holeShapes) {
      geometricShapeFactory.setSize(this._ds.distToMM(shape.holeR) * 2);
      geometricShapeFactory.setCentre(
        this._ds.pointToMM({ x: shape.x, y: shape.y })
      );
      holes.push(geometricShapeFactory.createCircle());
    }

    // For PAD that's a bit harder because they can be "slots"
    const padShapes = this._ds.findShapesByType("PAD");
    for (const shape of padShapes) {
      // Slot holes
      if (
        shape.holeR != 0 &&
        shape.slotPointArr &&
        shape.slotPointArr.length > 1
      ) {
        const coords = shape.slotPointArr.map((p) => {
          const pmm = this._ds.pointToMM(p);
          return new jsts.geom.Coordinate(pmm.x, pmm.y);
        });
        let lineString = geometryFactory.createLineString(coords);

        // To try reproduce EasyEDA behaviour, the outline has always a width of 0.3mm
        holes.push(lineString.buffer(this._ds.distToMM(shape.holeR)));
      }
      // Round holes
      else if (shape.holeR != 0) {
        geometricShapeFactory.setSize(this._ds.distToMM(shape.holeR) * 2);
        geometricShapeFactory.setCentre(this._ds.pointToMM(shape.holeCenter));
        holes.push(geometricShapeFactory.createCircle());
      }
    }

    return holes;
  }

  /**
   * Get components Object3D
   * @returns {Array<THREE.Object3D>} A list of 3D object that reprensent components and that can be added to a PCB scene
   */
  async _getComponents3dObjects() {
    // Get layers ids
    const bottomLayerId = this._ds.findLayerIdByName("BottomLayer");
    const topLayerId = this._ds.findLayerIdByName("TopLayer");

    // Find all 3D shapes from datastore
    let shapes = this._ds
      .findShapesByType("SVGNODE")
      .filter((s) => s.attrs.c_etype == "outline3D");

    // Loader for .obj with promise that will be use in parrallel
    const loadObj = (shape) => {
      return new Promise((resolve, reject) => {
        const loader = new THREE.OBJLoader();
        loader.load(
          DOWNLOAD_3D_URI + shape.attrs.uuid,
          (obj) => resolve({ obj, shape }),
          null,
          (error) => reject(error)
        );
      });
    };

    // Execute and wait for all promises
    const object3ds = [];
    const promises = shapes.map(loadObj);
    // Download all obj files and iterate on them
    const resList = await Promise.allSettled(promises);
    for (const { status, value, reason } of resList) {
      // Just log error, but continue
      if (status === "rejected") {
        console.error("Fail to load .obj file", reason);
        continue;
      }
      const { obj, shape } = value;

      // Get layer id from parent footprint
      const parentFootprint = this._ds.findShapeByGid(shape._footprint_gid);
      const isOnBottom = parentFootprint.head.layerid == bottomLayerId;

      // Scale
      const box = new THREE.Box3();
      box.expandByObject(obj);
      const scale =
        this._ds.distToMM(shape.attrs.c_width) / (box.max.x - box.min.x);
      let transformMatrix = new THREE.Matrix4();
      transformMatrix.makeScale(scale, scale, scale);
      obj.applyMatrix4(transformMatrix);

      // Rotate
      const rotation = shape.attrs.c_rotation
        .split(",")
        .map((v) => (v * Math.PI) / 180);
      obj.rotateX(rotation[0]);
      obj.rotateY(rotation[1]);
      obj.rotateZ(rotation[2]);

      let rObj = new THREE.Object3D();
      rObj.add(obj);

      // Center object in its space
      const box2 = new THREE.Box3();
      box2.expandByObject(obj);
      rObj.translateX(-box2.max.x + (box2.max.x - box2.min.x) / 2);
      rObj.translateY(-box2.max.y + (box2.max.y - box2.min.y) / 2);

      // Now that object is centered and scaled we add it to a neutral space
      // To do rotation and translation in the world space
      let normalizedObj = new THREE.Object3D();
      normalizedObj.add(rObj);

      // Rotate to put in on bottom if required
      if (isOnBottom) {
        obj.rotateY(Math.PI);
      }

      // Translate
      const p = shape.attrs.c_origin.split(",");
      let position = this._ds.pointToMM({ x: p[0], y: p[1] });
      normalizedObj.translateX(position.x);
      normalizedObj.translateY(position.y);
      normalizedObj.translateZ(isOnBottom ? 0 : BOARD_THICKNESS);

      // Set material
      normalizedObj.traverse(function (child) {
        if (child.isMesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
          });
        }
      });

      object3ds.push(normalizedObj);
    }
    return object3ds;
  }
}
window.extension3dExporterPcb3D = Pcb3D;
