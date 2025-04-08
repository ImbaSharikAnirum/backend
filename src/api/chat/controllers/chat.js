"use strict";

/**
 * chat controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

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
}));
