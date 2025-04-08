"use strict";

const dayjs = require("dayjs");
const greenapiService = require("../services/greenapi");

module.exports = {
  async receive(ctx) {
    const body = ctx.request.body;
    console.log("📥 RAW WEBHOOK BODY", body);

    if (body.typeWebhook !== "incomingMessageReceived") {
      return ctx.send({ status: "ignored" });
    }

    const typeMessage = body.messageData?.typeMessage;

    // 📦 Общие данные
    const chatId = body.senderData?.chatId;
    const phone = body.senderData?.sender;
    const senderName = body.senderData?.senderName;
    const timestamp = dayjs.unix(body.timestamp).toISOString();
    const messageId = body.idMessage;

    let text = "";
    let emoji = null;
    let reactionToMessageId = null;
    let mediaUrl = null;

    if (typeMessage === "textMessage") {
      text = body.messageData?.textMessageData?.textMessage || "";
    } else if (typeMessage === "reactionMessage") {
      emoji =
        body.messageData?.reactionMessageData?.emoji || // старый формат
        body.messageData?.extendedTextMessageData?.text || // новый формат
        "❤️";
      reactionToMessageId = body.messageData?.quotedMessage?.stanzaId || null;
    } else if (typeMessage === "imageMessage") {
      mediaUrl = body.messageData?.fileMessageData?.downloadUrl || null;
    } else {
      return ctx.send({ status: "ignored-type" });
    }

    console.log("📥 Обрабатываем сообщение:", {
      chatId,
      phone,
      senderName,
      typeMessage,
      text,
      emoji,
      timestamp,
      messageId,
      reactionToMessageId,
      mediaUrl,
    });

    try {
      // 👤 Контакт
      const contact = await greenapiService.findOrCreateContact({
        phone,
        name: senderName,
      });

      // 📱 Канал (shannel)
      const shannel = await strapi.db.query("api::shannel.shannel").findOne({
        where: { externalId: "greenapi-01" },
      });

      // 💬 Чат
      const { chat, isNew } = await greenapiService.findOrCreateChat({
        chatId,
        contactId: contact.id,
        shannelId: shannel?.id || null,
        timestamp,
      });

      // 💾 Сохраняем сообщение
      const savedMessage = await strapi.db
        .query("api::message.message")
        .create({
          data: {
            chat: chat.id,
            direction: "incoming",
            senderName,
            text,
            emoji,
            mediaUrl,
            messageId,
            reactionToMessageId,
            timestamp,
            status: "delivered",
            publishedAt: new Date().toISOString(),
          },
        });

      // 🕐 Обновляем чат
      await strapi.db.query("api::chat.chat").update({
        where: { id: chat.id },
        data: { lastMessage: timestamp, isClosed: false },
      });

      // 🌱 Если чат новый — шлем full info
      if (isNew) {
        const fullChat = await strapi.entityService.findOne(
          "api::chat.chat",
          chat.id,
          {
            fields: ["chatId", "lastMessage", "isClosed"],
            populate: {
              contact: true,
              shannel: true,
            },
          }
        );

        strapi.io.emit("chat:new", {
          id: fullChat.id,
          chatId: fullChat.chatId,
          name: fullChat.contact?.name || "Без имени",
          avatar: fullChat.contact?.avatar || "#f44336",
          isClosed: fullChat.isClosed,
          time: fullChat.lastMessage,
          lastMessage: {
            text: savedMessage.text || savedMessage.emoji || "",
            timestamp: savedMessage.timestamp,
            sender: savedMessage.senderName || "client",
          },
          messages: [savedMessage],
        });
      }

      // 📡 Отправляем в сокет
      strapi.io.emit("chat:message", {
        chatId,
        direction: "incoming",
        senderName,
        text,
        emoji,
        timestamp,
        messageId,
        reactionToMessageId,
        mediaUrl,
      });

      ctx.send({ status: "received" });
    } catch (error) {
      console.error("❌ Ошибка при обработке:", error);
      ctx.throw(500, error);
    }
  },
};
