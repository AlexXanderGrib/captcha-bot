import { MessageContext } from "vk-io";
import { text2speech } from "yandex-speech-promise";

import { Middleware } from "middleware-io";
import {
  stringifyComplexId,
  genCode,
  getTemplateRenderer,
  text2image
} from "../utils";
import { CaptchaStorage } from "../store";
import { phrases, config } from "..";
import { SimpleObject } from "../configLoader";

export default async function onUserJoin(
  store: CaptchaStorage
): Promise<Middleware<MessageContext>> {
  const templateMessage = getTemplateRenderer((await phrases) as SimpleObject);
  const { yak } = await config;
  const auth = `Api-Key ${yak}`;

  return async (context: MessageContext): Promise<void> => {
    if (
      (context.eventType === "chat_invite_user" ||
        context.eventType === "chat_invite_user_by_link") &&
      context.peerType === "chat"
    ) {
      const victim =
        (context.eventType === "chat_invite_user"
          ? context.eventMemberId
          : context.senderId) || 0;
      const xid = stringifyComplexId(context.chatId || 0, victim);

      if (victim > 0) {
        const code = genCode(6);

        const [user] = await context.vk.api.users.get({
          user_ids: String(victim)
        });

        const attachment: string[] = [];
        try {
          const image = await text2image(code);

          const imageInVK = await context.vk.upload.messagePhoto({
            peer_id: context.peerId,
            source: image
          });

          attachment.push(
            `photo${imageInVK.ownerId}_${imageInVK.id}_${imageInVK.accessKey}`
          );
        } catch (e) {
          console.error("Unable to upload photo for XID: ", xid, e);
        }

        try {
          const audio = await text2speech(`Код: ${code.split("").join(" ")}`, {
            auth,
            voice: "zahar",
            speed: 0.8
          });

          const audioInVK = await context.vk.upload.audioMessage({
            source: audio,
            peer_id: context.peerId
          });

          attachment.push(
            `doc${audioInVK.ownerId}_${audioInVK.id}_${audioInVK.accessKey}`
          );
        } catch (e) {
          console.error("Unable to upload audio for XID: ", xid, e);
        }

        store.add(
          xid,
          code,
          async () => {
            const {
              items: [chatData]
            } = await context.vk.api.messages.getConversationsById({
              group_id: context.$groupId || 0,
              peer_ids: context.peerId
            });

            await context.send(
              await templateMessage("captcha_fail", {
                user: `@id${user.id} (${user.first_name} ${user.last_name})`,
                admin: chatData.chat_settings.owner_id
              })()
            );

            await context.kickUser(victim);
          },
          1000 * 120
        );

        await context.send({
          ...(await templateMessage("user_join", {
            user: `@id${user.id} (${user.first_name} ${user.last_name})`
          })(attachment))
        });
      }
    }
  };
}
