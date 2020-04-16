import { xid2uc } from "../contract";

test("XID to user id and chat id converter", () => {
  expect(() => {
    xid2uc("ы");
  }).toThrowError("Failed constraint check");
});
