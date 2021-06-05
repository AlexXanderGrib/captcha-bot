import { EventEmitter } from "events";
import { promises as fs } from "fs";
import { Dictionary, Static, String as Str } from "runtypes";
import { Worker } from "worker_threads";
import {
  DataBasePath,
  FailedEvent,
  MessagesLeftEvent,
  PassUserRequestEvent,
  ReadyEvent,
  ShowCodeEvent,
  ShowUserPassEvent,
  SolvedEvent,
  UserDataStructure,
  UserJoinEvent,
  UserMessageEvent,
  XID,
  xid2uc
} from "../contract";
import { genCode } from "../utils";
import { has as isVerified } from "../verified";

export const USER_MESSAGES_BEFORE_KICK = 10;
export const DISK_THROTTLE = 30e3; // 30 second
export const TICK = 1000; // 1 second
export const TIME_BEFORE_KICK = 2 * 6e4; // 2 * minute

const TIMESTAMP = new Date(new Date().toUTCString());

const db = new Map<Static<typeof XID>, Static<typeof UserDataStructure>>();
const io = new EventEmitter();

const writer = new Worker(require.resolve("./writer.worker"));

async function preload() {
  const data = await fs
    .readFile(DataBasePath, { encoding: "utf8" })
    .catch(() => "{}");

  const obj = JSON.parse(data);

  const isValidDict = Dictionary(UserDataStructure, Str).validate(obj).success;

  if (isValidDict) {
    Object.keys(obj)
      .filter(k => XID.validate(k).success)
      .forEach(k => db.set(k, UserDataStructure.check(obj[k])));
  }
}

preload().then(() => io.emit("ready", {} as Static<typeof ReadyEvent>));

io.on("user-join", async params => {
  const { xid } = UserJoinEvent.check(params);
  const [uid] = xid2uc(xid);

  if (await isVerified(uid)) {
    io.emit("show-user-pass", {
      xid,
      reason: "Пользователь подтверждён администрацией Captcha Bot ✅"
    } as Static<typeof ShowUserPassEvent>);
  } else {
    const code = genCode();

    db.set(xid, {
      code,
      expiry: TIMESTAMP.getTime() + TIME_BEFORE_KICK,
      messagesLeft: USER_MESSAGES_BEFORE_KICK
    });

    io.emit("show-code", { code, xid } as Static<typeof ShowCodeEvent>);
  }
});

io.on("user-message", params => {
  const { text, xid } = UserMessageEvent.check(params);
  const record = db.get(xid);

  if (record) {
    if (text === record.code) {
      db.delete(xid);

      io.emit("solved", { xid } as Static<typeof SolvedEvent>);
    } else if (record.messagesLeft - 1 > 0) {
      record.messagesLeft -= 1;

      db.set(xid, record);

      io.emit("messages-left", {
        xid,
        left: record.messagesLeft
      } as Static<typeof MessagesLeftEvent>);
    } else {
      db.delete(xid);

      io.emit("failed", { xid } as Static<typeof FailedEvent>);
    }
  }
});

io.on("pass-user-request", params => {
  const { admin, xid } = PassUserRequestEvent.check(params);

  db.delete(xid);

  io.emit("show-user-pass", {
    xid,
    reason: `Модератор @id${admin} дал доступ к беседе`
  } as Static<typeof ShowUserPassEvent>);
});

function tick() {
  TIMESTAMP.setTime(TIMESTAMP.getTime() + TICK);

  db.forEach((record, xid) => {
    if (record.expiry < TIMESTAMP.getTime()) {
      db.delete(xid);

      io.emit("failed", { xid } as Static<typeof FailedEvent>);
    }
  });
}

function save() {
  return new Promise((resolve, reject) => {
    const obj = Object.fromEntries(db);

    function onMessage(data) {
      resolve(data);
      // eslint-disable-next-line no-use-before-define
      cleanupSave();
    }

    function onError(error) {
      reject(error);
      // eslint-disable-next-line no-use-before-define
      cleanupSave();
    }

    function cleanupSave() {
      writer.off("error", onError);
      writer.off("message", onMessage);
    }

    writer.once("message", onMessage);
    writer.once("error", onError);

    writer.postMessage(obj);
  });
}

const timer = setInterval(tick, TICK);
const saver = setInterval(save, DISK_THROTTLE);

export const cleanup = async (): Promise<void> => {
  await save();
  await writer.terminate();

  clearInterval(timer);
  clearInterval(saver);
};

process.on("beforeExit", cleanup);

export default io;
