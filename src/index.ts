import { Static } from "runtypes";
import { MessageContext, VK } from "vk-io";
import renderCode from "./captcha";
import {
  FailedEvent,
  MessagesLeftEvent,
  PassCommand,
  PassRegExp,
  phrases,
  settings,
  ShowCodeEvent,
  ShowUserPassEvent,
  SolvedEvent,
  uc2xid,
  UserJoinEvent,
  UserMessageEvent,
  xid2uc
} from "./contract";
import db from "./store";
import { render } from "./utils";

async function MessagesListener(context: MessageContext): Promise<void> {
  if (context.isChat) {
    const text = context.text || "";

    if (context.eventType === "chat_invite_user") {
      const xid = uc2xid([
        Number(context.eventMemberId) || 0,
        context.chatId || 0
      ]);

      if (context.eventMemberId === -(context.$groupId || 0)) {
        // if bot joined the conversation

        await context.send(phrases.selfJoin);
      } else if (Number(context.eventMemberId) > 0) {
        // user joined the conversation

        db.emit("user-join", { xid } as Static<typeof UserJoinEvent>);
      }
    } else {
      const xid = uc2xid([context.senderId, context.chatId || 0]);
      const pass = text.match(PassRegExp);

      if (pass && pass[2]) {
        const victim = parseInt(pass[2], 10);

        try {
          const {
            items: [currentChat]
          } = await context.vk.api.messages.getConversationsById({
            peer_ids: context.peerId
          });

          const moderators: number[] = Array.from(
            currentChat?.chat_settings?.admin_ids || []
          ).filter(item => typeof item === "number" && item > 0) as number[];

          const owner: number = currentChat?.chat_settings?.owner_id || 0;
          const admins = new Set([...moderators, owner]);

          if (!admins.has(context.senderId)) {
            throw new Error();
          }

          db.emit("pass-user-request", {
            xid: uc2xid([victim, context.chatId || 0]),
            admin: context.senderId
          });
        } catch (e) {
          await context.send(
            `@id${context.senderId} (Вы) не являетесь администратором беседы!`
          );
        }
      }

      db.emit("user-message", { xid, text } as Static<typeof UserMessageEvent>);
    }
  }
}

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

  vk.updates.on("message", MessagesListener);

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

  db.on("messages-left", async params => {
    const { xid, left: messages } = MessagesLeftEvent.check(params);

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

  db.on("solved", async params => {
    const { xid } = SolvedEvent.check(params);
    const [id, chat_id] = xid2uc(xid);

    await vk.api.messages.send({
      chat_id,
      message: render(phrases.solved.message, { id }),
      attachment: phrases.solved.attachment.join(",")
    });
  });

  db.on("failed", async params => {
    const { xid } = FailedEvent.check(params);

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

  db.on("show-user-pass", async params => {
    const { reason, xid } = ShowUserPassEvent.check(params);

    const [uid, cid] = xid2uc(xid);

    await vk.api.messages.send({
      chat_id: cid,
      message: `Пользователь @id${uid} был допущен к беседе без прохождения каптчи
      
Причина: ${reason}`
    });
  });

  db.on("show-code", async params => {
    const { code, xid } = ShowCodeEvent.check(params);
    const [uid, cid] = xid2uc(xid);

    const peer_id = cid + 2e9;

    const [image, audio] = await renderCode(code);

    const [photo, voice] = await Promise.all([
      vk.upload.messagePhoto({
        peer_id,
        source: image
      }),
      vk.upload.audioMessage({
        peer_id,
        source: audio
      })
    ]);

    await vk.api.messages.send({
      chat_id: cid,
      message: render(phrases.userJoin.message, {
        user: await mention(uid),
        id: uid,
        command: PassCommand
      }),
      attachment: [
        ...phrases.userJoin.attachment,
        `photo${photo.ownerId}_${photo.id}_${photo.accessKey}`,
        `doc${voice.ownerId}_${voice.id}_${voice.accessKey}`
      ].join(",")
    });
  });

  db.on("ready", async () => {
    ready = true;

    switch (process.env.NODE_ENV) {
      case "development":
        await vk.updates.startPolling();
        break;
      case "production":
        await vk.updates.startWebhook({
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
