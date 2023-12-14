// Since all imports are hoisted in ES6 and later it is not possible to set the env var in server.js and then import config.
// process.env["NODE_CONFIG_DIR"] = path.resolve(__dirname, "..", "config");
// import config from "config";
// Effectively the import will run before env var setting.
// As a workaround we set the env var in a separate file that is imported before config import.
// See https://github.com/node-config/node-config/issues/402
import path from "path";

process.env["NODE_CONFIG_DIR"] = path.resolve(__dirname);
