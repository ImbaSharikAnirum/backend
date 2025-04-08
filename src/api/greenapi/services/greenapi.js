"use strict";

module.exports = {
  async findOrCreateContact({ phone, name }) {
    let contact = await strapi.db
      .query("api::contact.contact")
      .findOne({ where: { phone } });
    if (!contact) {
      contact = await strapi.db.query("api::contact.contact").create({
        data: { phone, name, publishedAt: new Date().toISOString() },
      });
    }
    return contact;
  },

  async findOrCreateChat({ chatId, contactId, shannelId, timestamp }) {
    let chat = await strapi.db
      .query("api::chat.chat")
      .findOne({ where: { chatId } });

    if (!chat) {
      chat = await strapi.db.query("api::chat.chat").create({
        data: {
          chatId,
          contact: contactId,
          shannel: shannelId,
          lastMessage: timestamp,
          isClosed: false,
          publishedAt: new Date().toISOString(),
        },
      });

      // Добавляем связь в shannel.chats
      if (shannelId) {
        await strapi.db.query("api::shannel.shannel").update({
          where: { id: shannelId },
          data: {
            chats: {
              connect: [{ id: chat.id }],
            },
          },
        });
      }

      return { chat, isNew: true };
    }

    return { chat, isNew: false };
  },

  async saveMessage({
    chatId,
    direction,
    senderName,
    text,
    timestamp,
    status,
    emoji,
  }) {
    return strapi.db.query("api::message.message").create({
      data: {
        chat: chatId,
        direction,
        senderName,
        text,
        emoji,
        timestamp,
        status,
        messageId, // ✅ сохраняем ID сообщения
        reactionToMessageId, // ✅ если есть — сохраняем ссылку на сообщение
        publishedAt: new Date().toISOString(),
      },
    });
  },
  getGreenApiConfig(externalId) {
    const MAP = {
      "greenapi-01": {
        apiUrl: "1103.api.green-api.com",
        idInstance: "1103217888",
        apiTokenInstance: process.env.TOKEN_GREEN_API_INSTANCE,
      },
    };
    return MAP[externalId];
  },

  async sendToGreenApi({ config, chatId, message }) {
    const url = `https://${config.apiUrl}/waInstance${config.idInstance}/sendMessage/${config.apiTokenInstance}`;


    // Форматируем chatId для WhatsApp
    const formattedChatId = chatId.endsWith("@c.us")
      ? chatId
      : `${chatId}@c.us`;

    const payload = {
      chatId: formattedChatId,
      message: message,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          `Green API error: ${responseData.message || "Unknown error"}`
        );
      }

      return responseData;
    } catch (error) {
      throw error;
    }
  },
};
