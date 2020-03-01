import { render } from "mustache";
import Jimp from "jimp";
import { SimpleObject } from "./configLoader";

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

export function stringifyComplexId(chatId: number, userId: number): string {
  return `${chatId}:${userId}`;
}

export type TemplateRenderer = (
  templateId: string,
  replacements?: SimpleObject
) => (
  additionalAttachments?: string[]
) => { message: string; attachment: string[] };

export function getTemplateRenderer(phrases: SimpleObject): TemplateRenderer {
  return function renderTemplate(
    templateId: string,
    replacements: SimpleObject = {}
  ) {
    const message = phrases[`${templateId}_message`];
    const attachments = phrases[`${templateId}_attachments`];

    return (
      attachment: string[] = []
    ): { message: string; attachment: string[] } => ({
      message: render(typeof message === "string" ? message : "", replacements),
      attachment: (Array.isArray(attachments)
        ? attachments.filter(a => typeof a === "string").concat(attachments)
        : attachment) as string[]
    });
  } as TemplateRenderer;
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

  return image.getBufferAsync(Jimp.MIME_JPEG);
}
