import { API } from "vk-io";
import { MessagesSendParams } from "vk-io/lib/api/schemas/params";

export default class MessagingService {
  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly api: API) {}

  send(params: MessagesSendParams): Promise<number> {
    return this.api.messages.send({
      random_id: Date.now(),
      ...params
    });
  }
}
