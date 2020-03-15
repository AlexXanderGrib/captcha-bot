import getUTC from "ntp-client-promise";
import { EventEmitter } from "events";
import { genCode } from "./utils";

const RECORD_LIFETIME = 6e4 * 2;
const CODE_LENGTH = 6;

type StoredUserData = {
  code: string;
  expiry: number;
  messagesLeft: number;
};

const db = new Map<string, StoredUserData>();
const io = new EventEmitter();

export default io;

let TIMESTAMP = ((): number => {
  setInterval(() => {
    TIMESTAMP += 1000;
  }, 1000);

  getUTC("uk.pool.ntp.org")
    .then(date => {
      TIMESTAMP = date.getTime();
    })
    .then(() => io.emit("ready"));

  return new Date(new Date().toUTCString()).getTime();
})();

io.on("user-join", (xid: string) => {
  const code = genCode(CODE_LENGTH);

  db.set(xid, {
    code,
    expiry: TIMESTAMP + RECORD_LIFETIME,
    messagesLeft: 10
  });

  io.emit("show-code", xid, code);
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

const cleaner = setInterval(() => {
  db.forEach((record, xid) => {
    if (TIMESTAMP > record.expiry) {
      io.emit("failed", xid);
      db.delete(xid);
    }
  });
}, 1000);

process.on("beforeExit", () => clearInterval(cleaner));
