import { speech2text } from "yandex-speech-promise";
import renderCode from "../captcha";
import { CaptchaCode, settings } from "../contract";
import { genCode } from "../utils";

jest.setTimeout(30000);

const code = genCode();

describe("Captcha Code", () => {
  test(`Is valid`, () => {
    expect(CaptchaCode.validate(code).success).toBeTruthy();
  });

  test("Is sounds correct", async () => {
    const [, audio] = await renderCode(code);

    const response = await speech2text(audio, {
      auth: `Api-Key ${settings.yandexApiKey}`,
      lang: "ru-RU",
      topic: "general"
    });

    expect(response).toMatch(`Код ${code.split("").join(" ")}`);
  });
});
