"use strict";

/**
 * chat controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const greenapiService = require("../../greenapi/services/greenapi");

module.exports = createCoreController("api::chat.chat", ({ strapi }) => ({
  async find(ctx) {
    // Вытаскиваем стандартную реализацию find
    const { data, meta } = await super.find(ctx);

    // Кастомная сортировка на случай, если не указана
    if (!ctx.query.sort) {
      data.sort((a, b) => {
        const timeA = new Date(a.attributes.lastMessage || 0).getTime();
        const timeB = new Date(b.attributes.lastMessage || 0).getTime();
        return timeB - timeA; // Сначала самые свежие
      });
    }

    return { data, meta };
  },

  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      console.log("📥 Входящие данные:", data);

      if (!data || !data.contact || !data.message?.text) {
        throw new Error("Не указаны обязательные поля: contact и message.text");
      }

      const { chatId, contact, shannel, lastMessage, isClosed, message } = data;
      console.log("📝 Данные чата:", {
        chatId,
        contact,
        shannel,
        lastMessage,
        isClosed,
      });

      // Нормализуем номер телефона (убираем @c.us если есть)
      const normalizedPhone = contact.replace("@c.us", "");
      console.log("📱 Нормализованный номер:", normalizedPhone);

      // Проверяем существующий чат
      const existingChat = await strapi.db.query("api::chat.chat").findOne({
        where: { chatId: `${normalizedPhone}@c.us` },
        populate: ["contact", "shannel", "messages"],
      });
      console.log("🔍 Существующий чат:", existingChat);

      if (existingChat) {
        console.log("🔄 Обновляем существующий чат");
        // Если чат существует, просто создаем новое сообщение
        const createdMessage = await strapi.db
          .query("api::message.message")
          .create({
            data: {
              chat: existingChat.id,
              text: message.text,
              direction: message.direction,
              senderName: message.senderName,
              timestamp: message.timestamp,
              status: message.status,
              publishedAt: new Date().toISOString(),
            },
          });
        console.log("💬 Создано сообщение:", createdMessage);

        // Обновляем аватар и имя контакта, если их нет
        if (
          !existingChat.contact?.attributes?.avatarUrl ||
          !existingChat.contact?.attributes?.name
        ) {
          console.log("🔄 Обновляем данные контакта");
          const config = greenapiService.getGreenApiConfig("greenapi-01");
          const contactInfo = await greenapiService.getContactInfo({
            config,
            chatId: `${normalizedPhone}@c.us`,
          });
          console.log("📱 Информация о контакте из WhatsApp:", contactInfo);

          const updateData = {};
          if (
            contactInfo.avatarUrl &&
            !existingChat.contact?.attributes?.avatarUrl
          ) {
            updateData.avatarUrl = contactInfo.avatarUrl;
          }
          if (contactInfo.name && !existingChat.contact?.attributes?.name) {
            updateData.name = contactInfo.name;
          }

          console.log("📝 Данные для обновления контакта:", updateData);

          if (Object.keys(updateData).length > 0) {
            await strapi.db.query("api::contact.contact").update({
              where: { id: existingChat.contact.id },
              data: updateData,
            });
            console.log("✅ Контакт обновлен");
          }
        }

        // Отправляем сообщение через Green API
        try {
          const config = greenapiService.getGreenApiConfig("greenapi-01");
          const result = await greenapiService.sendToGreenApi({
            config,
            chatId: `${normalizedPhone}@c.us`,
            message: message.text,
          });
          console.log("📤 Результат отправки через Green API:", result);

          // Обновляем сообщение с ID из Green API
          if (result && result.idMessage) {
            await strapi.db.query("api::message.message").update({
              where: { id: createdMessage.id },
              data: {
                messageId: result.idMessage,
                status: "sent",
              },
            });
            console.log("✅ Сообщение обновлено с ID из Green API");
          }
        } catch (error) {
          console.error("❌ Ошибка при отправке через Green API:", error);
          await strapi.db.query("api::message.message").update({
            where: { id: createdMessage.id },
            data: {
              status: "error",
              error: error.message,
            },
          });
        }

        // Обновляем lastMessage в чате
        await strapi.db.query("api::chat.chat").update({
          where: { id: existingChat.id },
          data: {
            lastMessage: message.timestamp,
            isClosed: false,
          },
        });
        console.log("✅ Чат обновлен");

        return existingChat;
      }

      // Находим или создаем контакт
      let contactData = await strapi.db.query("api::contact.contact").findOne({
        where: { phone: normalizedPhone },
      });
      console.log("👤 Найденный контакт:", contactData);

      if (!contactData) {
        console.log("➕ Создаем новый контакт");
        // Получаем информацию о контакте из WhatsApp
        const config = greenapiService.getGreenApiConfig("greenapi-01");
        const contactInfo = await greenapiService.getContactInfo({
          config,
          chatId: `${normalizedPhone}@c.us`,
        });
        console.log("📱 Информация о контакте из WhatsApp:", contactInfo);

        contactData = await strapi.db.query("api::contact.contact").create({
          data: {
            phone: normalizedPhone,
            name: contactInfo.name,
            avatarUrl: contactInfo.avatarUrl,
            publishedAt: new Date().toISOString(),
          },
        });
        console.log("✅ Создан контакт:", contactData);
      }

      // Создаем чат
      const chat = await strapi.db.query("api::chat.chat").create({
        data: {
          chatId: `${normalizedPhone}@c.us`,
          contact: contactData.id,
          shannel,
          lastMessage,
          isClosed,
          publishedAt: new Date().toISOString(),
        },
      });
      console.log("✅ Создан чат:", chat);

      // Создаем сообщение
      const createdMessage = await strapi.db
        .query("api::message.message")
        .create({
          data: {
            chat: chat.id,
            text: message.text,
            direction: message.direction,
            senderName: message.senderName,
            timestamp: message.timestamp,
            status: message.status,
            publishedAt: new Date().toISOString(),
          },
        });
      console.log("💬 Создано сообщение:", createdMessage);

      // Отправляем сообщение через Green API
      try {
        const config = greenapiService.getGreenApiConfig("greenapi-01");
        const result = await greenapiService.sendToGreenApi({
          config,
          chatId: `${normalizedPhone}@c.us`,
          message: message.text,
        });
        console.log("📤 Результат отправки через Green API:", result);

        // Обновляем сообщение с ID из Green API
        if (result && result.idMessage) {
          await strapi.db.query("api::message.message").update({
            where: { id: createdMessage.id },
            data: {
              messageId: result.idMessage,
              status: "sent",
            },
          });
          console.log("✅ Сообщение обновлено с ID из Green API");
        }
      } catch (error) {
        console.error("❌ Ошибка при отправке через Green API:", error);
        await strapi.db.query("api::message.message").update({
          where: { id: createdMessage.id },
          data: {
            status: "error",
            error: error.message,
          },
        });
      }

      // Возвращаем созданный чат с полными данными
      const populatedChat = await strapi.db.query("api::chat.chat").findOne({
        where: { id: chat.id },
        populate: ["contact", "shannel", "messages"],
      });
      console.log("✅ Финальный чат:", populatedChat);

      return populatedChat;
    } catch (error) {
      console.error("❌ Ошибка при создании чата:", error);
      throw error;
    }
  },
}));
