import { promises as fs } from "fs";
import { EOL } from "os";
import { VerifiedListPath } from "./contract";

let loaded = false;
const state = new Set<number>();

async function load() {
  const data = await fs.readFile(VerifiedListPath, "utf8").catch(() => "");

  data
    .split(EOL)
    .map(parseInt)
    .filter(n => !!n)
    .forEach(a => state.add(a));

  loaded = true;
}

export async function read(): Promise<Set<number>> {
  if (!loaded) await load();

  return state;
}

async function write() {
  const data = Array.from(state).join(EOL);

  await fs.writeFile(VerifiedListPath, data, { encoding: "utf8" });
}

export async function add(id: number): Promise<Set<number>> {
  if (!loaded) await load();

  state.add(id);

  await write();

  return state;
}

export async function remove(id: number): Promise<Set<number>> {
  if (!loaded) await load();

  state.delete(id);

  await write();

  return state;
}

export async function has(id: number): Promise<boolean> {
  if (!loaded) await load();

  return state.has(id);
}
