import getUTC from "ntp-client-promise";
import { EventEmitter } from "events";
import { promises as fs } from "fs";
import { join } from "path";
import { genCode, xid2uc } from "./utils";
import { checkPass } from "./userpass";

import prevSaved = require("../db/captchas.json");

const RECORD_LIFETIME = 6e4 * 2;
const CODE_LENGTH = 6;
const DISK_THRESHOLD = 1e4;
const DB_PATH = join(__dirname, "..", "db", "captchas.json");

type StoredUserData = {
  code: string;
  expiry: number;
  messagesLeft: number;
};

const db = new Map<string, StoredUserData>();
const io = new EventEmitter();

export default io;

function preload(): void {
  Object.keys(prevSaved as object).forEach(key => {
    const value = prevSaved[key];

    if (
      typeof value === "object" &&
      "expiry" in value &&
      typeof value.expiry === "number" &&
      "code" in value &&
      typeof value.code === "string" &&
      "messagesLeft" in value &&
      typeof value.messagesLeft === "number"
    ) {
      db.set(key, value as StoredUserData);
    }
  });
}

let TIMESTAMP = ((): number => {
  setInterval(() => {
    TIMESTAMP += 1000;
  }, 1000);

  getUTC("uk.pool.ntp.org")
    .then(date => {
      TIMESTAMP = date.getTime();
    })
    .then(() => preload())
    .then(() => io.emit("ready"));

  return new Date(new Date().toUTCString()).getTime();
})();

io.on("user-join", async (xid: string) => {
  const [uid] = xid2uc(xid);

  const autopass = await checkPass(uid);

  if (autopass) {
    io.emit(
      "allow-pass",
      xid,
      uid,
      "Пользователь подтверждён администрацией Captcha Bot"
    );
  } else {
    const code = genCode(CODE_LENGTH);

    db.set(xid, {
      code,
      expiry: TIMESTAMP + RECORD_LIFETIME,
      messagesLeft: 10
    });

    io.emit("show-code", xid, code);
  }
});

io.on("user-message", (xid: string, message: string) => {
  if (db.has(xid)) {
    const record = db.get(xid) as StoredUserData;

    if (message.trim().substring(0, CODE_LENGTH) === record.code) {
      io.emit("solved", xid);

      db.delete(xid);
    } else {
      const messagesLeft = record.messagesLeft - 1;

      if (messagesLeft > 0) {
        io.emit("messages-left", xid, messagesLeft);

        db.set(xid, { ...record, messagesLeft });
      } else {
        io.emit("failed", xid);
        db.delete(xid);
      }
    }
  }
});

io.on("pass", (xid: string, admin: number) => {
  db.delete(xid);

  io.emit("allow-pass", xid, admin);
});

const cleaner = setInterval(() => {
  db.forEach((record, xid) => {
    if (TIMESTAMP > record.expiry) {
      io.emit("failed", xid);
      db.delete(xid);
    }
  });
}, 1000);

async function save(): Promise<void> {
  const obj = Object.fromEntries(db);

  await fs.writeFile(DB_PATH, JSON.stringify(obj), { encoding: "utf8" });

  io.emit("data-saved", Date.now());
}

const writer = setInterval(save, DISK_THRESHOLD);

process.on("beforeExit", async () => {
  await save();

  clearInterval(cleaner);
  clearInterval(writer);
});
