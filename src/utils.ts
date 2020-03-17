import Jimp from "jimp";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { join } from "path";
import { serialize, deserialize } from "v8";

export function uc2xid(userId: number, chatId: number): string {
  return serialize([userId, chatId]).toString("hex");
}

export function xid2uc(xid: string): [number, number] {
  const result = deserialize(Buffer.from(xid, "hex"));

  if (
    Array.isArray(result) &&
    typeof result[0] === "number" &&
    typeof result[1] === "number"
  ) {
    return [result[0], result[1]];
  }

  throw new Error("Failed to deserialize XID");
}

export function genCode(length: number): string {
  function rand(): number {
    return Math.round(-0.5 + Math.random() * 10);
  }

  let code = "";

  while (code.length < length) {
    code += rand().toString();
  }

  return code;
}

export async function text2image(text: string): Promise<string> {
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
  const path = join(
    tmpdir(),
    `captcha-bot-${randomBytes(16).toString("hex")}.jpg`
  );

  await fs.writeFile(path, data);

  return path;
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
