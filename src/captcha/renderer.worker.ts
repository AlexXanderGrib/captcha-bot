import { parentPort, MessagePort } from "worker_threads";
import { text2speech } from "yandex-speech-promise";
import { settings } from "../contract";
import { text2image } from "../utils";

if (!parentPort) throw new Error("This file  must be a worker thread");

parentPort.on("message", async ({ code, rand }) => {
  const audio = await text2speech(`Код: ${code.split("").join(" ")}`, {
    auth: `Api-Key ${settings.yandexApiKey}`
  });

  const image = await text2image(code);

  (parentPort as MessagePort).postMessage({ rand, audio, image });
});
