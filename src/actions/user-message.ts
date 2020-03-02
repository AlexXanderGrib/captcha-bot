import { MessageContext } from "vk-io";
import { Middleware } from "middleware-io";
import { stringifyComplexId, getTemplateRenderer } from "../utils";
import { CaptchaStorage } from "../store";
import { phrases } from "..";
import { SimpleObject } from "../configLoader";

export default async function onUserMessage(
  storage: CaptchaStorage
): Promise<Middleware<MessageContext>> {
  const templateMessage = getTemplateRenderer((await phrases) as SimpleObject);

  return async (context: MessageContext): Promise<void> => {
    const xid = stringifyComplexId(context.chatId || 0, context.senderId);
    if (storage.has(xid)) {
      const [user] = await context.vk.api.users.get({
        user_ids: String(context.senderId)
      });

      if (storage.solve(xid, context.text || "")) {
        await context.send(
          await templateMessage("captcha_completed", {
            id: context.senderId
          })()
        );
      } else {
        const messagesLeft = storage.decrementMessages(xid);

        if (messagesLeft < 4 && messagesLeft > 0) {
          await context.send(
            await templateMessage("messages_left", {
              user: `@id${user.id} (${user.first_name} ${user.last_name})`,
              messages: messagesLeft
            })()
          );
        } else if (messagesLeft < 1) {
          const {
            items: [chatData]
          } = await context.vk.api.messages.getConversationsById({
            group_id: context.$groupId || 0,
            peer_ids: context.peerId
          });

          await context.send(
            await templateMessage("captcha_fail", {
              user: `@id${user.id} (${user.first_name} ${user.last_name})`,
              admin: `https://vk.com/id${chatData.chat_settings.owner_id}`
            })()
          );

          storage.clear(xid);

          await context.kickUser(context.senderId);
        }
      }
    }
  };
}
