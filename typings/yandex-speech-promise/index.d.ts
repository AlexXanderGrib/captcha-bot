declare module "yandex-speech-promise" {
  export type TopicsRU = {
    lang: "ru-RU";
    topic: "general" | "general:rc";
  };

  export type TopicsEN = {
    lang: "en-US";
    topic: "general" | "maps";
  };

  export type TopicsTR = {
    lang: "tr-TR";
    topic: "general" | "maps";
  };

  export type YandexSTTParams = {
    profanityFilter?: boolean;
    format?: "lpcm" | "oggopus";
    sampleRateHertz?: 48000 | 16000 | 8000;
    folderId?: string;
    auth: string;
  } & (TopicsEN | TopicsRU | TopicsTR);

  export function speech2text(
    audio: Buffer,
    params: YandexSTTParams
  ): Promise<string>;

  export type YanexVoices =
    | "oksana"
    | "jane"
    | "omazh"
    | "zahar"
    | "ermil"
    | "silaerkan"
    | "erkanyavas"
    | "alyss"
    | "nick"
    | "alena"
    | "filipp";

  export type YandexTTSParams = {
    ssml?: boolean;
    lang?: "ru-RU" | "en-US" | "tr-TR";
    voice?: YanexVoices;
    emotion?: "good" | "neutral" | "evil";
    speed?: number;
    format?: "lpcm" | "oggopus";
    sampleRateHertz?: 48000 | 16000 | 8000;
    folderId?: string;
    auth: string;
  };

  export async function text2speech(
    text: string,
    params: YandexTTSParams
  ): Promise<Buffer>;
}
