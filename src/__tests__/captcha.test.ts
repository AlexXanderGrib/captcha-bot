import { speech2text } from "yandex-speech-promise";
import renderCode from "../captcha";
import { genCode } from "../utils";
import { settings, CaptchaCode } from "../contract";

jest.setTimeout(30000);

const code = genCode();

describe("Captcha Code", () => {
  test(`Is valid`, () => {
    expect(CaptchaCode.validate(code).success).toBeTruthy();
  });

  test("Is sounds correct", async () => {
    const [, audio] = await renderCode(code);

    const r = await speech2text(audio, {
      auth: `Api-Key ${settings.yandexApiKey}`,
      lang: "ru-RU",
      topic: "general"
    });

    expect(r).toMatch(`код ${code.split("").join(" ")}`);
  });
});
