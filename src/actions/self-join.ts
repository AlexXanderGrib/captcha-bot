import { MessageContext } from "vk-io";
import { Middleware } from "middleware-io";
import { getTemplateRenderer } from "../utils";
import { phrases } from "..";
import { SimpleObject } from "../configLoader";

export default async function onSelfJoin(): Promise<
  Middleware<MessageContext>
> {
  const templateMessage = getTemplateRenderer((await phrases) as SimpleObject);

  return async (context: MessageContext): Promise<void> => {
    if (
      context.peerType === "chat" &&
      context.eventType === "chat_invite_user" &&
      context.eventMemberId === -(context.$groupId || 0)
    ) {
      await context.send(templateMessage("self_join")());
    }
  };
}
