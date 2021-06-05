/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-var-requires */
import { readFileSync } from "fs";
import { resolve } from "path";
import { Contract, Number, Record, String, Tuple } from "runtypes";
import { parse } from "yaml";

export const CAPTCHA_CODE_LENGTH = 6;
export const Positive = Number.withConstraint(n => n > 0);

export const UC = Tuple(Positive, Positive);
export const XID = String.withConstraint(str => {
  try {
    UC.validate(JSON.parse(str));

    return true;
  } catch (e) {
    return false;
  }
});

export const CaptchaCode = String.withConstraint(
  str => str.length === CAPTCHA_CODE_LENGTH
);

export const uc2xid = Contract(UC, XID).enforce(uc => {
  return JSON.stringify(uc);
});

export const xid2uc = Contract(XID, UC).enforce(xid => {
  const uc = JSON.parse(xid);

  return UC.check(uc);
});

export const UserDataStructure = Record({
  code: CaptchaCode,
  messagesLeft: Positive,
  expiry: Positive
});

export const ReadyEvent = Record({});
export const UserMessageEvent = Record({
  xid: XID,
  text: String
});
export const UserJoinEvent = Record({
  xid: XID
});
export const MessagesLeftEvent = Record({
  xid: XID,
  left: Positive
});
export const DataSavedEvent = Record({
  ts: Positive
});
export const PassUserRequestEvent = Record({
  xid: XID,
  admin: Positive
});
export const ShowUserPassEvent = Record({
  xid: XID,
  reason: String
});
export const ShowCodeEvent = Record({
  xid: XID,
  code: CaptchaCode
});
export const SolvedEvent = Record({
  xid: XID
});
export const FailedEvent = Record({
  xid: XID
});

const phrasesPath = resolve(__dirname, "../config/phrases.yml");

export const phrases = parse(readFileSync(phrasesPath, "utf-8"));
export const settings = require("../config/bot.json");

export const DataBasePath = resolve(__dirname, "..", "db", "captcha.json");
export const VerifiedListPath = resolve(__dirname, "..", "db", "verified.csv");

export const PassCommand = "!пропустить";
export const PassRegExp = /^!пропустить (\[id([0-9]+)\|.*\])$/;
