import { MessageContext, VK } from "vk-io";
import { Middleware } from "middleware-io";
import load from "./configLoader";
import store, { CaptchaStorage } from "./store";
import onUserMessage from "./actions/user-message";
import onUserJoin from "./actions/user-join";
import onSelfJoin from "./actions/self-join";

export const phrases = load("phrases");
export const config = load("bot") as Promise<{
  token: string;
  v: number;
  id: number;
  yak: string;
  host: string;
  port: number;
  path: string;
  secret: string;
  confirmation: string;
}>;

async function main(
  extensions: ((store: CaptchaStorage) => Promise<Middleware<MessageContext>>)[]
): Promise<void> {
  const { token, v, id, host, port, path, secret, confirmation } = await config;
  const vk = new VK({
    token,
    apiVersion: String(v),
    pollingGroupId: id,
    webhookConfirmation: confirmation,
    webhookSecret: secret
  });

  vk.updates.on("message", async context => {
    console.log(context);

    for (const ext of extensions) {
      const middleware = await ext(store);

      await middleware(context, () => Promise.resolve());
    }
  });

  switch (process.env.NODE_ENV) {
    case "development":
      await vk.updates.startPolling();
      break;
    case "production":
      await vk.updates.startWebhook({ host, port, path });
      break;
    default:
      throw new Error("Environment not selected");
  }

  console.log("🦄 Bot started! (in %s mode)", process.env.NODE_ENV);
}

export default main([onUserMessage, onUserJoin, onSelfJoin]);
