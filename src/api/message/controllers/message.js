"use strict";

/**
 * message controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const greenapiService = require("../../greenapi/services/greenapi");

module.exports = createCoreController("api::message.message", ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;

    const { chat, direction, senderName, text, timestamp, status } = data;

    // Получаем чат с информацией о канале
    const chatData = await strapi.entityService.findOne(
      "api::chat.chat",
      chat,
      {
        populate: ["shannel"],
      }
    );
    console.log("💬 CHAT FOUND:", chatData);

    // Создаем сообщение
    // 1. Используем let для переменной message
    let message = await strapi.entityService.create("api::message.message", {
      data: {
        chat,
        direction,
        senderName,
        text,
        timestamp,
        status,
        publishedAt: new Date().toISOString(),
      },
    });

    // 2. После успешной отправки через Green API обновляем сообщение
    if (direction === "outgoing" && chatData.shannel) {
      try {
        const config = greenapiService.getGreenApiConfig(
          chatData.shannel.externalId
        );

        const result = await greenapiService.sendToGreenApi({
          config,
          chatId: chatData.chatId,
          message: text,
        });

        // 3. Обновляем сообщение в базе
        message = await strapi.entityService.update(
          "api::message.message",
          message.id,
          {
            data: {
              messageId: result.idMessage,
            },
          }
        );
      } catch (error) {
        console.error("❌ GREEN API ERROR:", error);
        throw error;
      }
    }

    return message;
  },
  async find(ctx) {
    // 👉 насильно добавляем populate[chat]
    ctx.query = {
      ...ctx.query,
      populate: {
        ...ctx.query.populate,
        chat: {
          fields: ["chatId"],
        },
      },
    };

    const { data, meta } = await super.find(ctx);

    const enrichedData = data.map((msg) => {
      const chatId = msg?.attributes?.chat?.data?.attributes?.chatId || null;

      return {
        ...msg,
        attributes: {
          ...msg.attributes,
          chatId, // 👈 добавляем сюда
        },
      };
    });

    return { data: enrichedData, meta };
  },
}));
