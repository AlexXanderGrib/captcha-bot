import Jimp from "jimp";
import { Static } from "runtypes";
import { CAPTCHA_CODE_LENGTH, CaptchaCode } from "./contract";

export type AllowPromise<T> = T | Promise<T>;
export type AllowArray<T> = T | T[];

export function genCode(): Static<typeof CaptchaCode> {
  function rand(): number {
    return Math.round(-0.5 + Math.random() * 10);
  }

  return new Array(CAPTCHA_CODE_LENGTH)
    .fill(0) // [0, 0, 0, 0, 0, 0] fulfill with zeros
    .map(rand) // [4, 3, 5, 2, 7, 8] make its random
    .join(""); // "456278" concat into string
}

export async function text2image(text: string): Promise<Buffer> {
  const image = await new Jimp(512, 512, 0xffffffff);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);

  image.print(
    font,
    0,
    0,
    {
      text,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    },
    image.bitmap.width,
    image.bitmap.height
  );

  image.quality(80);

  const data = await image.getBufferAsync(Jimp.MIME_JPEG);

  return data;
}

export function render(text: string, replacements: object): string {
  return text.replace(/{{([A-z_0-9]+)}}/g, (_, prop: string) => {
    const desc = Object.getOwnPropertyDescriptor(replacements, prop);

    if (desc) {
      return String(desc.value);
    }

    return String(undefined);
  });
}
