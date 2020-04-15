import { parentPort, MessagePort } from "worker_threads";
import { promises as fs } from "fs";

import { DB_PATH } from "../contract";

if (!parentPort) throw new Error("This file must be a worker");

const p = parentPort; // This is an elder chinese hack

p.on("message", async obj => {
  const data = JSON.stringify(obj);

  await fs.writeFile(DB_PATH, data, { encoding: "utf8" });

  const now = new Date(new Date().toUTCString());

  (parentPort as MessagePort).postMessage(now.getTime());
});
