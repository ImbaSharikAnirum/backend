"use strict";

module.exports = {
  async findOrCreateContact({ phone, name }) {
    const normalizedPhone = phone.replace("@c.us", "");
    console.log("🔍 Поиск контакта:", normalizedPhone);

    let contact = await strapi.db
      .query("api::contact.contact")
      .findOne({ where: { phone: normalizedPhone } });

    console.log("📱 Найден контакт:", contact);

    if (!contact) {
      const config = this.getGreenApiConfig("greenapi-01");
      const contactInfo = await this.getContactInfo({
        config,
        chatId: `${normalizedPhone}@c.us`,
      });

      console.log("📥 [GreenAPI] Ответ getContactInfo:", contactInfo);

      const newContactData = {
        phone: normalizedPhone,
        name: contactInfo.name || name,
        publishedAt: new Date().toISOString(),
      };

      if (contactInfo.avatarUrl) {
        console.log("✅ Аватар получен:", contactInfo.avatarUrl);
        newContactData.avatarUrl = contactInfo.avatarUrl;
      } else {
        console.warn("⚠️ Аватар не получен или пустой");
      }

      contact = await strapi.db.query("api::contact.contact").create({
        data: newContactData,
      });
      console.log("✅ Новый контакт создан:", contact);
    }

    return contact;
  },

  async findOrCreateChat({ chatId, contactId, shannelId, timestamp }) {
    console.log("🔍 Поиск чата:", { chatId, contactId, shannelId });

    let chat = await strapi.db
      .query("api::chat.chat")
      .findOne({ where: { chatId } });

    console.log("💬 Найден чат:", chat);

    if (!chat) {
      console.log("➕ Создание нового чата");
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

      console.log("✅ Новый чат создан:", chat);

      // Привязываем к каналу (shannel)
      if (shannelId) {
        await strapi.db.query("api::shannel.shannel").update({
          where: { id: shannelId },
          data: {
            chats: {
              connect: [{ id: chat.id }],
            },
          },
        });
        console.log("✅ Чат привязан к каналу:", shannelId);
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
    messageId,
    reactionToMessageId,
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
        messageId: messageId || null,
        reactionToMessageId: reactionToMessageId || null,
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
    const formattedChatId = chatId.endsWith("@c.us")
      ? chatId
      : `${chatId}@c.us`;

    const url = `https://${config.apiUrl}/waInstance${config.idInstance}/sendMessage/${config.apiTokenInstance}`;

    const payload = {
      chatId: formattedChatId,
      message,
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
      console.log("📤 Ответ от Green API:", responseData);

      if (!response.ok || responseData?.code) {
        throw new Error(
          `Green API error: ${
            responseData.message || responseData.description || "Unknown error"
          }`
        );
      }

      return responseData;
    } catch (error) {
      console.error("❌ Ошибка при отправке через Green API:", error.message);
      throw error;
    }
  },

  async getContactInfo({ config, chatId }) {
    const formattedChatId = chatId.endsWith("@c.us")
      ? chatId
      : `${chatId}@c.us`;

    const url = `https://${config.apiUrl}/waInstance${config.idInstance}/getContactInfo/${config.apiTokenInstance}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatId: formattedChatId }),
      });

      const responseData = await response.json();
      console.log("📥 [GreenAPI] getContactInfo response:", responseData);

      if (!response.ok || responseData?.code) {
        throw new Error(
          `Green API error: ${
            responseData.message || responseData.description || "Unknown error"
          }`
        );
      }

      return {
        name: responseData.name || null,
        avatarUrl: responseData.avatar || responseData.urlAvatar || null,
      };
    } catch (error) {
      console.error(
        "❌ Ошибка при получении информации о контакте:",
        error.message
      );
      return { name: null, avatarUrl: null };
    }
  },
};
