# EasyEDA 3dExport extension

This extension allows you to export a 3D file out of EasyEDA.

## Dev workflow

Install Nodejs 12+ and clone this repository. Then start the dev server:

```
npm i
npm run start
```

It will open the `src/dev/index.html` file that mock EasyEDA API to make it more easy to dev.

## Build and use the extension

```
npm run build
```

Then into EasyEda import the content of the dist directory as an extension.
