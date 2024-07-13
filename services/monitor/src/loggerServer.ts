import http from "http";
import monitorLoggerInstance, { setLogLevel, validLogLevels } from "./logger";

const port = process.env.NODE_LOG_LEVEL_SERVER_PORT || 3333;

// Simple server to set the log level dynamically.
// UNAUTHENTICATED
const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const { level } = JSON.parse(body);

        if (validLogLevels.includes(level)) {
          setLogLevel(level);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: `Log level set to ${level}` }));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid log level" }));
        }
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON format" }));
      }
    });
  } else {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
  }
});

server.listen(port, () => {
  monitorLoggerInstance.info(
    `Dynamic log level server listening on port ${port}`,
  );
});
