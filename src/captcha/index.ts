import { Worker } from "worker_threads";
import { CaptchaCode } from "../contract";

const renderer = new Worker(require.resolve("./renderer.worker"));

renderer.setMaxListeners(0);

process.on("beforeExit", renderer.terminate);

export default function renderCode(code: string): Promise<[Buffer, Buffer]> {
  const rand = Math.round(Math.random() * 1024) % 1024;

  CaptchaCode.check(code);

  return new Promise((resolve, reject) => {
    renderer.postMessage({ code, rand });
    process.on("beforeExit", () => reject());

    const handler = async ({ audio, image, rand: m }) => {
      if (rand === m) {
        if (process.env.NODE_ENV === "test") {
          await renderer.terminate();
        }

        renderer.off("message", handler);

        resolve([Buffer.from(image), Buffer.from(audio)]);
      }
    };

    renderer.on("message", handler);
  });
}
