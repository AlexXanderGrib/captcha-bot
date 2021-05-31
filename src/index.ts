import { Static } from "runtypes";
import { API, MessageContext, VK } from "vk-io";
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
import MessagingService from "./ms";
import db from "./store";
import { render } from "./utils";

async function MessagesListener(
  context: MessageContext,
  api: API
): Promise<void> {
  if (context.isChat) {
    const text = context.text || "";

    if (
      context.eventType === "chat_invite_user" ||
      context.eventType === "chat_invite_user_by_link"
    ) {
      if (context.eventMemberId && context.eventMemberId < 0) return;

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
      if (context.senderId < 0) return;
      const xid = uc2xid([context.senderId, context.chatId || 0]);
      const pass = text.match(PassRegExp);

      if (pass && pass[2]) {
        const victim = parseInt(pass[2], 10);

        try {
          const {
            items: [currentChat]
          } = await api.messages.getConversationsById({
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

  vk.updates.on("message", context => MessagesListener(context, vk.api));

  const ms = new MessagingService(vk.api);

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

      await ms.send({
        chat_id,
        ...phrases.messagesLimit,
        message: render(phrases.messagesLimit.message, { user, messages })
      });
    }
  });

  db.on("solved", async params => {
    const { xid } = SolvedEvent.check(params);
    const [id, chat_id] = xid2uc(xid);

    await ms.send({
      chat_id,
      ...phrases.solved,
      message: render(phrases.solved.message, { id })
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

      await ms.send({
        chat_id,
        ...phrases.failed,
        message: render(phrases.failed.message, {
          user,
          admin
        })
      });

      await vk.api.messages.removeChatUser({
        chat_id,
        user_id: id
      });
    } catch (_) {
      await ms.send({
        chat_id,
        ...phrases.noAdmin,
        message: render(phrases.noAdmin.message, { user })
      });
    }
  });

  db.on("show-user-pass", async params => {
    const { reason, xid } = ShowUserPassEvent.check(params);

    const [uid, cid] = xid2uc(xid);

    await ms.send({
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
        source: { value: image }
      }),
      vk.upload.audioMessage({
        peer_id,
        source: { value: audio }
      })
    ]);

    await ms.send({
      chat_id: cid,
      message: render(phrases.userJoin.message, {
        user: await mention(uid),
        id: uid,
        command: PassCommand
      }),
      attachment: [
        ...(phrases.userJoin?.attachment || []),
        `photo${photo.ownerId}_${photo.id}_${photo.accessKey}`,
        `doc${voice.ownerId}_${voice.id}_${voice.accessKey}`
      ].join(",")
    });
  });

  db.on("ready", async () => {
    ready = true;
    const mode = process.env.MODE || "LP";

    switch (mode) {
      case "LP":
        await vk.updates.startPolling();
        break;
      case "CP":
        await vk.updates.startWebhook({
          port: parseInt(process.env.PORT || "") || settings.port,
          path: settings.path
        });
        break;
      default:
        throw new Error("Environment not selected");
    }

    console.log(
      "🦄 Bot started! (in %s env mode=%s)",
      process.env.NODE_ENV,
      mode
    );
  });
}

export default main();
