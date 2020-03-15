import { VK } from "vk-io";
import { text2speech } from "yandex-speech-promise";
import db from "./store";
import { render, uc2xid, xid2uc, text2image } from "./utils";

import phrases = require("../config/phrases.json");
import settings = require("../config/bot.json");

function main(): void {
  let ready = false;

  setTimeout(() => {
    if (!ready) {
      throw new Error("DB not ready until 5s");
    }
  }, 5000);

  const vk = new VK({
    token: settings.token,
    apiVersion: String(settings.v),
    pollingGroupId: settings.id,
    webhookConfirmation: settings.confirmation,
    webhookSecret: settings.secret
  });

  vk.updates.on("message", async context => {
    if (context.isChat) {
      if (context.eventType === "chat_invite_user") {
        const xid = uc2xid(
          Number(context.eventMemberId) || 0,
          context.chatId || 0
        );

        if (context.eventMemberId === -(context.$groupId || 0)) {
          // if bot joined the conversation

          await context.send(phrases.selfJoin);
        } else if (Number(context.eventMemberId) > 0) {
          // user joined the conversation

          db.emit("user-join", xid);
        }
      } else {
        const xid = uc2xid(context.senderId, context.chatId || 0);

        db.emit("user-message", xid, context.text || "");
      }
    }
  });

  async function mention(id: number): Promise<string> {
    try {
      const [{ first_name, last_name }] = await vk.api.users.get({
        user_ids: String(id)
      });

      return `@id${id} (${first_name} ${last_name})`;
    } catch (_) {
      return `@id${id}`;
    }
  }

  db.on("messages-left", async (xid: string, messages: number) => {
    if (messages < 4) {
      const [id, chat_id] = xid2uc(xid);

      const user = await mention(id);

      await vk.api.messages.send({
        chat_id,
        message: render(phrases.messagesLimit.message, { user, messages }),
        attachment: phrases.messagesLimit.attachment.join(",")
      });
    }
  });

  db.on("show-code", async (xid: string, code: string) => {
    const [id, chat_id] = xid2uc(xid);
    const image = await text2image(code);
    const audio = await text2speech(`Код: ${code.split("").join(" ")}`, {
      auth: `Api-Key ${settings.yandexApiKey}`,
      speed: 0.8,
      voice: "zahar"
    });

    const audioMessage = await vk.upload.audioMessage({
      peer_id: chat_id + 2e9,
      source: audio
    });

    const photo = await vk.upload.messagePhoto({
      peer_id: chat_id + 2e9,
      source: image
    });

    await vk.api.messages.send({
      chat_id,
      message: render(phrases.userJoin.message, {
        user: await mention(id)
      }),
      attachment: [
        ...phrases.userJoin.attachment,
        `photo${photo.ownerId}_${photo.id}_${photo.accessKey}`,
        `doc${audioMessage.ownerId}_${audioMessage.id}_${audioMessage.accessKey}`
      ].join(",")
    });
  });

  db.on("solved", async (xid: string) => {
    const [id, chat_id] = xid2uc(xid);

    await vk.api.messages.send({
      chat_id,
      message: render(phrases.solved.message, { id }),
      attachment: phrases.solved.attachment.join(",")
    });
  });

  db.on("failed", async (xid: string) => {
    const [id, chat_id] = xid2uc(xid);

    const user = await mention(id);

    try {
      const {
        items: [conversation]
      } = await vk.api.messages.getConversationsById({
        peer_ids: chat_id + 2e9
      });

      const admin = conversation?.chat_settings?.owner_id || 0;

      await vk.api.messages.send({
        chat_id,
        message: render(phrases.failed.message, {
          user,
          admin
        }),
        attachment: phrases.failed.attachment.join(",")
      });

      await vk.api.messages.removeChatUser({
        chat_id,
        user_id: id
      });
    } catch (_) {
      await vk.api.messages.send({
        chat_id,
        message: render(phrases.noAdmin.message, { user }),
        attachment: phrases.noAdmin.attachments.join(",")
      });
    }
  });

  db.on("ready", async () => {
    ready = true;

    switch (process.env.NODE_ENV) {
      case "development":
        await vk.updates.startPolling();
        break;
      case "production":
        await vk.updates.startWebhook({
          host: settings.host,
          port: settings.port,
          path: settings.path
        });
        break;
      default:
        throw new Error("Environment not selected");
    }

    console.log("🦄 Bot started! (in %s mode)", process.env.NODE_ENV);
  });
}

export default main();
//   // Initialization
//   const {
//     token,
//     v,
//     id,
//     host,
//     port,
//     path,
//     secret,
//     confirmation,
//     yak
//   } = await config;
//   const ph = await phrases;
//   const templateMessage = await getTemplateRenderer(ph as SimpleObject);
//   const [db, emitter] = await store();

//   // Bot realization

//   vk.updates.on("message", async context => {
//     const xid = stringifyComplexId(context.chatId || 0, context.senderId);

//     if (
//       context.peerType === "chat" &&
//       context.eventType === "chat_invite_user" &&
//
//     ) {
//       await context.send(templateMessage("self_join")());
//     }
//   });

// }

// export default main();
