import { promises as fs } from "fs";
import { MessagePort, parentPort } from "worker_threads";
import { DataBasePath } from "../contract";

if (!parentPort) throw new Error("This file must be a worker");

// This is an elder chinese hack

parentPort.on("message", async obj => {
  const data = JSON.stringify(obj);

  await fs.writeFile(DataBasePath, data, { encoding: "utf8" });

  const now = new Date(new Date().toUTCString());

  (parentPort as MessagePort).postMessage(now.getTime());
});
