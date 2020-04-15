import { promises as fs } from "fs";
import { EOL } from "os";
import { VF_PATH } from "./contract";

let loaded = false;
const state = new Set<number>();

async function load() {
  const data = await fs.readFile(VF_PATH, "utf8");

  data
    .split(EOL)
    .map(parseInt)
    .filter(n => !!n)
    .forEach(a => state.add(a));

  loaded = true;
}

export async function read() {
  if (!loaded) await load();

  return state;
}

async function write() {
  if (!loaded) await load();

  const data = Array.from(state).join(EOL);

  await fs.writeFile(VF_PATH, data, { encoding: "utf8" });
}

export async function add(id: number) {
  state.add(id);

  await write();

  return state;
}

export async function remove(id: number) {
  state.delete(id);

  await write();

  return state;
}

export async function has(id: number) {
  if (!loaded) await load();

  return state.has(id);
}
