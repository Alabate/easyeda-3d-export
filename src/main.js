import * as THREE from "three";
import DataStore from "./DataStore";
import Pcb3D from "./Pcb3D";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const BOARD_THICKNESS = 3;

const SCREEN_WIDTH = window.innerWidth;
const SCREEN_HEIGHT = window.innerHeight;

let renderer, scene, camera;

// Load 3d-data example file
// The following command needs to be started :
//      npx http-server /home/alabate/dev/easyeda-3d-export
// And the page accessed from http://127.0.0.1:8081/test.html

function init(datastore) {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x808080);

  // Cameras
  camera = new THREE.PerspectiveCamera(
    75,
    SCREEN_WIDTH / SCREEN_HEIGHT,
    0.1,
    1000
  );
  scene.add(camera);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.1));
  camera.add(new THREE.PointLight(0xffffff, 1));

  // Renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  $("#extension-3dExporter-preview-threejs").append(renderer.domElement);

  // Add PCB to scene
  const pcb3d = new Pcb3D(datastore);
  pcb3d.addToScene(scene);

  // Controls
  const boardCentroid = pcb3d.getPcbBoardCentroid();
  const controls = new OrbitControls(camera, renderer.domElement);
  camera.position.set(boardCentroid.getX(), boardCentroid.getY(), 100);
  controls.target.set(boardCentroid.getX(), boardCentroid.getY(), 0);
  controls.update();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Add the toolbar button
api("createToolbarButton", {
  title: "Export 3D file..",
  fordoctype: "pcb",
  menu: [
    {
      text: "Exporter preview",
      cmd: "extension-3dExporter-preview",
    },
    {
      text: "Export to glTF-JSON (.gltf)",
      cmd: "extension-3dExporter-export-gltf",
    },
    {
      text: "Export to glTF-binary (.glb)",
      cmd: "extension-3dExporter-export-glb",
    },
    {
      text: "Export to PLY (.ply)",
      cmd: "extension-3dExporter-export-ply",
    },
    {
      text: "Export to Collada (.dae)",
      cmd: "extension-3dExporter-export-dae",
    },
  ],
});

function startExport(format) {
  const data = api("getSource", { type: "json" });
  alert("OK" + format);
  console.log(data);
}

// Command router
api("createCommand", {
  "extension-3dExporter-preview": () => {
    $previewDialog.dialog("open");

    // Once dialog is opened, start 3D preview
    const div3D = $("#extension-3dExporter-preview-threejs");

    const data = api("getSource", { type: "json" });
    console.log("data", data);
    const datastore = new DataStore(data);
    init(datastore);
    animate();
  },
  "extension-3dExporter-export-gltf": () => {
    startExport("gltf");
  },
  "extension-3dExporter-export-glb": () => {
    startExport("glb");
  },
  "extension-3dExporter-export-ply": () => {
    startExport("ply");
  },
  "extension-3dExporter-export-dae": () => {
    startExport("dae");
  },
});

const $previewDialog = api("createDialog", {
  title: "3D Exporter Preview",
  content: '<div id="extension-3dExporter-preview-threejs">a</div>',
  width: $(window).width() * 0.9,
  height: $(window).height() * 0.9,
  modal: true,
  buttons: [
    {
      text: "Close",
      cmd: "dialog-close",
    },
  ],
});
