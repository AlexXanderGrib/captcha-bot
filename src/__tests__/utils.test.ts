import { randomBytes } from "crypto";
import { fromBuffer } from "file-type";
import { render, text2image } from "../utils";

describe("Message Renderer", () => {
  test("Must correctly replace string values", () => {
    const who = randomBytes(4).toString("hex");

    const result = render("Hello {{who}}!", { who });

    expect(result).toMatch(`Hello ${who}!`);
  });

  test("Must replace non-existing property by undefined", () => {
    const result = render("Hello {{who}}!", {});

    expect(result).toMatch(`Hello undefined!`);
  });
});

test("Text to Image", async () => {
  const buf = await text2image("1488");

  const data = await fromBuffer(buf);

  expect(data).not.toBeUndefined();
  expect(data?.mime || "").toMatch("image/jpeg");
});
