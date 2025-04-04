"use strict";

const dayjs = require("dayjs");
const greenapiService = require("../services/greenapi");

module.exports = {
  async receive(ctx) {
    const body = ctx.request.body;

    if (body.typeWebhook !== "incomingMessageReceived") {
      return ctx.send({ status: "ignored" });
    }

    const chatId = body.senderData.chatId;
    const phone = body.senderData.sender;
    const senderName = body.senderData.senderName;
    const text = body.messageData?.textMessageData?.textMessage || "";
    const timestamp = dayjs.unix(body.timestamp).toISOString();

    const contact = await greenapiService.findOrCreateContact({
      phone,
      name: senderName,
    });

    const shannel = await strapi.db.query("api::shannel.shannel").findOne({
      where: { externalId: "greenapi-01" },
    });

    const { chat, isNew } = await greenapiService.findOrCreateChat({
      chatId,
      contactId: contact.id,
      shannelId: shannel?.id || null,
      timestamp,
    });

    // 💬 Сохраняем сообщение
    const savedMessage = await greenapiService.saveMessage({
      chatId: chat.id,
      direction: "incoming",
      senderName,
      text,
      timestamp,
      status: "delivered",
    });

    // 🕐 Обновляем последний message time
    await strapi.db.query("api::chat.chat").update({
      where: { id: chat.id },
      data: { lastMessage: timestamp },
    });

    // 🔔 Если чат только что создан — отправим его на фронт с сообщением
    if (isNew) {
      const fullChat = await strapi.entityService.findOne(
        "api::chat.chat",
        chat.id,
        {
          populate: ["contact", "shannel"],
        }
      );

      strapi.io.emit("chat:new", {
        ...fullChat,
        messages: [savedMessage],
      });
    }

    // 📡 Отправляем сообщение в комнату
    console.log("📤 Отправка сообщения через сокет:", {
      chatId,
      message: {
        chatId,
        direction: "incoming",
        senderName,
        text,
        timestamp,
      },
      connectedClients: strapi.io.sockets.adapter.rooms.get(chatId)?.size || 0,
    });

    strapi.io.to(chatId).emit("chat:message", {
      chatId,
      direction: "incoming",
      senderName,
      text,
      timestamp,
    });

    ctx.send({ status: "received" });
  },

  async send(ctx) {
    const { chatId, message } = ctx.request.body;

    if (!chatId || !message) {
      return ctx.badRequest("chatId and message are required");
    }

    const chat = await strapi.db.query("api::chat.chat").findOne({
      where: { chatId },
      populate: ["shannel"],
    });

    if (!chat || !chat.shannel) {
      return ctx.notFound("Chat or shannel not found");
    }

    const config = greenapiService.getGreenApiConfig(chat.shannel.externalId);
    const data = await greenapiService.sendToGreenApi({
      config,
      chatId,
      message,
    });

    const timestamp = new Date().toISOString();

    await greenapiService.saveMessage({
      chatId: chat.id,
      direction: "outgoing",
      senderName: "Менеджер",
      text: message,
      timestamp,
      status: "sent",
    });

    console.log("📤 Отправка исходящего сообщения через сокет:", {
      chatId,
      message: {
        chatId,
        direction: "outgoing",
        senderName: "Менеджер",
        text: message,
        timestamp,
      },
      connectedClients: strapi.io.sockets.adapter.rooms.get(chatId)?.size || 0,
    });

    strapi.io.to(chatId).emit("chat:message", {
      chatId,
      direction: "outgoing",
      senderName: "Менеджер",
      text: message,
      timestamp,
    });

    ctx.send({ success: true, response: data });
  },
};
