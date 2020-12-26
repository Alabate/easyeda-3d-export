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

const $errorNotOn3d = api('createDialog', {
	title: "Error: 3D View not found!",
	content : '<div style="padding:10px;">Please open the 3D view that you want to export.</div>',
	modal : true,
	buttons : [{
			text : 'OK',
			cmd : 'dialog-close'
		}
	]
});

function startExport(format) {
  // This function will get the data of the last 3D view generated
  const data = window.exportFunction.attrFn.get3DData();
  // TODO: Find a better way to force user to be on the 3D view,
  // or it may use the last one the user have seen with another pcb design
  if (data) {
    alert("OK" + format);
    console.log(JSON.parse(data))
  }
  else {
    $errorNotOn3d.dialog('open');
    Locale.update($errorNotOn3d);
  }
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
