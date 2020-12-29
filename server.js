const express = require("express");
const https = require("https");
const http = require("http");
const app = express();
const port = 3000;

/**
 * Proxy all subrequests to https://easyeda.com
 */
const PROXY_URL = "https://easyeda.com";
app.use("/proxy", function (clientRequest, clientResponse) {
  const parsedHost = PROXY_URL.split("/").splice(2).splice(0, 1).join("/");
  let parsedPort;
  let parsedSSL;
  if (PROXY_URL.startsWith("https://")) {
    parsedPort = 443;
    parsedSSL = https;
  } else if (PROXY_URL.startsWith("http://")) {
    parsedPort = 80;
    parsedSSL = http;
  }
  console.log(clientRequest.url);
  const options = {
    hostname: parsedHost,
    port: parsedPort,
    path: clientRequest.url,
    method: clientRequest.method,
    headers: {
      "User-Agent": clientRequest.headers["user-agent"],
    },
  };

  const serverRequest = parsedSSL.request(options, function (serverResponse) {
    let body = "";
    if (
      String(serverResponse.headers["content-type"]).indexOf("text/html") !== -1
    ) {
      serverResponse.on("data", function (chunk) {
        body += chunk;
      });

      serverResponse.on("end", function () {
        clientResponse.writeHead(
          serverResponse.statusCode,
          serverResponse.headers
        );
        clientResponse.end(body);
      });
    } else {
      serverResponse.pipe(clientResponse, {
        end: true,
      });
      clientResponse.contentType(serverResponse.headers["content-type"]);
    }
  });

  serverRequest.end();
});

app.use(express.static("."));

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
