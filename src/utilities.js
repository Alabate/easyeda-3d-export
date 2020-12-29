/**
 * Load a remote js file in a <script> tag and return promise once done
 * @param {string} url Url of the remote js file to load
 */
window.extension3dExporterLoadJs = (url) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => {
      resolve();
    };
    script.error = (e) => {
      reject(e);
    };
    document.head.appendChild(script);
  });
};
