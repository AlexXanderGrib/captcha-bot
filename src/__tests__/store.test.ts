import { writeFileSync } from "fs";
import { Static } from "runtypes";
import {
  CaptchaCode,
  DataBasePath,
  FailedEvent,
  MessagesLeftEvent,
  PassUserRequestEvent,
  ShowCodeEvent,
  ShowUserPassEvent,
  SolvedEvent,
  uc2xid,
  UserJoinEvent,
  UserMessageEvent
} from "../contract";
import db, { cleanup, USER_MESSAGES_BEFORE_KICK } from "../store";
import { read as getVerifiedUsers } from "../verified";

jest.setTimeout(30000);

writeFileSync(DataBasePath, "{}", { encoding: "utf8" });

describe("Database", () => {
  afterAll(() => cleanup());

  test("Must be ready in 5s", async () => {
    const value = await new Promise(resolve => {
      db.on("ready", () => resolve(true));
    });

    expect(value).toBe(true);
  }, 5000);

  test("Must ask show the code", async () => {
    const xid = uc2xid([1, 1]); // User: #1, Chat: #1

    db.emit("user-join", { xid } as Static<typeof UserJoinEvent>);

    const code = await new Promise(resolve => {
      db.on("show-code", params => {
        const { xid: x, code: c } = ShowCodeEvent.check(params);

        if (x === xid) resolve(c);
      });
    });

    expect(CaptchaCode.validate(code).success).toBeTruthy();
  });

  test("Must decrease counter of allowed messages if message isn't code", () => {
    const xid = uc2xid([2, 1]); // User: #2, Chat: #1
    const notACode = "";

    const left = new Promise((resolve: CallableFunction) => {
      db.on("messages-left", params => {
        const { left: m, xid: x } = MessagesLeftEvent.check(params);

        if (x === xid) resolve(m);
      });
    });

    db.emit("user-join", { xid } as Static<typeof UserJoinEvent>);

    db.emit("user-message", { text: notACode, xid } as Static<
      typeof UserMessageEvent
    >);

    expect(left).resolves.toBeLessThan(USER_MESSAGES_BEFORE_KICK);
  });

  test("Must send kick message after user left all allowed messages", () => {
    const xid = uc2xid([3, 1]); // User: #3, Chat: #1
    const notACode = "";

    const kickAwaiter = new Promise(resolve => {
      db.on("failed", params => {
        const { xid: x } = FailedEvent.check(params);

        if (x === xid) resolve(true);
      });
    });

    db.emit("user-join", { xid } as Static<typeof UserJoinEvent>);

    for (let i = 0; i <= USER_MESSAGES_BEFORE_KICK; i += 1) {
      db.emit("user-message", { text: notACode, xid } as Static<
        typeof UserMessageEvent
      >);
    }

    expect(kickAwaiter).resolves.toBe(true);
  });

  test("Must notify if users solved captcha", async () => {
    const xid = uc2xid([4, 1]); // User: #4, Chat: #1

    const solveAwaiter = new Promise(resolve => {
      db.on("solved", params => {
        const { xid: x } = SolvedEvent.check(params);

        if (x === xid) resolve(true);
      });
    });

    db.emit("user-join", { xid } as Static<typeof UserJoinEvent>);

    const code = await new Promise(resolve => {
      db.on("show-code", params => {
        const { xid: x, code: c } = ShowCodeEvent.check(params);

        if (x === xid) resolve(c);
      });
    });

    db.emit("user-message", { text: code, xid } as Static<
      typeof UserMessageEvent
    >);

    expect(solveAwaiter).resolves.toBe(true);
  });

  test("Must be able to pass user", () => {
    const xid = uc2xid([5, 1]); // User: #5, Chat: #1
    const admin /** Admin ID */ = 1488;

    const passAwaiter = new Promise(resolve => {
      db.on("show-user-pass", params => {
        const { reason, xid: x } = ShowUserPassEvent.check(params);

        if (x === xid) resolve(reason);
      });
    });

    db.emit("user-join", { xid } as Static<typeof UserJoinEvent>);

    db.emit("pass-user-request", { admin, xid } as Static<
      typeof PassUserRequestEvent
    >);

    expect(passAwaiter).resolves.toContain(`@id${admin}`);
  });

  test("Must bypass Verified Users", async () => {
    const [uid] = await getVerifiedUsers();
    const xid = uc2xid([uid, 1]); // User: <Someone verified>, Chat: #1

    const passAwaiter = new Promise(resolve => {
      db.on("show-user-pass", params => {
        const { reason, xid: x } = ShowUserPassEvent.check(params);

        if (x === xid) resolve(reason);
      });
    });

    db.emit("user-join", { xid } as Static<typeof UserJoinEvent>);

    expect(passAwaiter).resolves.toContain("✅");
  });
});
