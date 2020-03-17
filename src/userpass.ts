import { promises as fs } from "fs";
import { join } from "path";
import { EOL } from "os";

let loadTime = 0;
const db = new Set<number>();

const dbpath = join(__dirname, "..", "db", "verified.csv");

async function read(): Promise<void> {
  const data = await fs.readFile(dbpath, { encoding: "utf8" });

  data.split(EOL).forEach(str => db.add(parseInt(str, 10)));

  loadTime = Date.now();
}

async function write(): Promise<void> {
  const arr = Array.from(db);

  await fs.writeFile(dbpath, arr.join(EOL), { encoding: "utf8" });

  loadTime = Date.now();
}

export async function checkPass(uid: number): Promise<boolean> {
  if (loadTime + 3e4 < Date.now()) {
    await read();
  }

  return db.has(uid);
}

export async function addPass(uid: number): Promise<void> {
  db.add(uid);

  await write();
}

export async function removePass(uid: number): Promise<void> {
  db.delete(uid);

  await write();
}
