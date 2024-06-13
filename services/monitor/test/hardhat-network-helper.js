const treeKill = require("tree-kill");
const { spawn } = require("child_process");

exports.startHardhatNetwork = async function (port) {
  return new Promise((resolve) => {
    const hardhatNodeProcess = spawn("npx", [
      "hardhat",
      "node",
      "--port",
      port.toString(),
    ]);

    hardhatNodeProcess.stderr.on("data", (data) => {
      console.error(`Hardhat Network Error: ${data.toString()}`);
    });

    hardhatNodeProcess.stdout.on("data", (data) => {
      console.log(data.toString());
      if (
        data
          .toString()
          .includes("Started HTTP and WebSocket JSON-RPC server at")
      ) {
        resolve(hardhatNodeProcess);
      }
    });
  });
};

exports.stopHardhatNetwork = async function (hardhatNodeProcess) {
  return new Promise((resolve, reject) => {
    treeKill(hardhatNodeProcess.pid, "SIGTERM", (err) => {
      if (err) {
        console.error(`Failed to kill process tree: ${err}`);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
