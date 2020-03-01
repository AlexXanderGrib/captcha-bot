/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
const { VK } = require("vk-io")
const { parse } = require("yaml")
const { readFileSync } = require("fs")
const { convert: ttp } = require("text-to-picture")
const { text2speech } = require("yandex-speech-promise")
const { render } = require("mustache")
const config = require("./config.json")

const { token, v, id } = config
const storage = require("./storage")

const auth = `Api-Key ${config["yandex-api-key"]}`

const phrases = parse(readFileSync("phrases.yml", { encoding: "utf8" }))

const vk = new VK({
  token,
  apiVersion: v,
  pollingGroupId: id
})

function genCode(length) {
  function rand() {
    return Math.round(-0.5 + Math.random() * 10)
  }

  let code = ""

  while (code.length < length) {
    code += rand().toString()
  }

  return code
}

function stringifyComplexId(chatId, userId) {
  return `${chatId}:${userId}`
}

function templateMessage(msgId, replacements = {}) {
  const messageTemplate = phrases[`${msgId}_message`]
  const attachment = phrases[`${msgId}_attachments`] || []

  return { message: render(messageTemplate, replacements), attachment }
}

async function main() {
  vk.updates.on("message", async context => {
    console.log(context)

    if (context.peerType === "chat") {
      if (
        context.eventType === "chat_invite_user" ||
        context.eventType === "chat_invite_user_by_link"
      ) {
        const victim =
          context.eventType === "chat_invite_user"
            ? context.eventMemberId
            : context.senderId
        const xid = stringifyComplexId(context.chatId, victim)

        if (victim === -id) {
          const msg = await templateMessage("self_join")
          console.log(msg)

          await context.send(msg)
        }

        if (victim > 0) {
          const code = genCode(6)

          const [user] = await vk.api.users.get({
            user_ids: victim
          })

          const image = await ttp({ text: code })
          const buf = await image.getBuffer()

          const imageInVK = await vk.upload.messagePhoto({
            peer_id: context.peerId,
            source: buf
          })

          const audio = await text2speech(`Код: ${code.split("").join(" ")}`, {
            auth,
            voice: "jane",
            speed: 0.8
          })

          const audioInVK = await vk.upload.audioMessage({
            source: audio,
            peer_id: context.peerId
          })

          storage.add(
            xid,
            code,
            async () => {
              const {
                items: [chatData]
              } = await vk.api.messages.getConversationsById({
                group_id: id,
                peer_ids: context.peerId
              })

              await context.send(
                await templateMessage("captcha_fail", {
                  user: `@id${user.id} (${user.first_name} ${user.last_name})`,
                  admin: chatData.chat_settings.owner_id
                })
              )

              await context.kickUser(victim)
            },
            1000 * 120
          )

          await context.send({
            ...(await templateMessage("user_join", {
              user: `@id${user.id} (${user.first_name} ${user.last_name})`
            })),
            attachment: [
              `photo${imageInVK.ownerId}_${imageInVK.id}_${imageInVK.accessKey}`,
              `doc${audioInVK.ownerId}_${audioInVK.id}_${audioInVK.accessKey}`
            ]
          })
        }
      } else {
        const xid = stringifyComplexId(context.chatId, context.senderId)
        if (storage.codes.has(xid)) {
          const [user] = await vk.api.users.get({
            user_ids: context.senderId
          })

          if (storage.solve(xid, context.text)) {
            await context.send(
              await templateMessage("captcha_completed", {
                id: context.senderId
              })
            )
          } else {
            const messagesLeft = storage.decrementMessages(xid)

            console.log(`XID: ${xid} messages left: ${messagesLeft}`)

            if (messagesLeft < 4 && messagesLeft > 0) {
              await context.send(
                await templateMessage("messages_left", {
                  user: `@id${user.id} (${user.first_name} ${user.last_name})`,
                  messages: messagesLeft
                })
              )
            } else if (messagesLeft < 1) {
              const {
                items: [chatData]
              } = await vk.api.messages.getConversationsById({
                group_id: id,
                peer_ids: context.peerId
              })

              await context.send(
                await templateMessage("captcha_fail", {
                  user: `@id${user.id} (${user.first_name} ${user.last_name})`,
                  admin: `https://vk.com/id${chatData.chat_settings.owner_id}`
                })
              )

              storage.clear(xid)

              await context.kickUser(context.senderId)
            }
          }
        }
      }
    }
  })

  vk.updates.use((context, next) => console.log(context) && next())

  await vk.updates.startPolling()

  console.log("🌈 Polling started")
}

main()
