// Add the toolbar button
api("createToolbarButton", {
  title: "Export 3D file..",
  menu: [
    {
      text: "Export to glTF-JSON (.gltf)",
      cmd: "extension-3dExporter-export-gltf",
    },
    {
      text: "Export to glTF-binary (.glb)",
      cmd: "extension-3dExporter-export-glb",
    },
    { text: "Export to PLY (.ply)", cmd: "extension-3dExporter-export-ply" },
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
  "extension-3dExporter-export-gltf": function () {
    startExport("gltf");
  },
  "extension-3dExporter-export-glb": function () {
    startExport("glb");
  },
  "extension-3dExporter-export-ply": function () {
    startExport("ply");
  },
  "extension-3dExporter-export-dae": function () {
    startExport("dae");
  },
});
