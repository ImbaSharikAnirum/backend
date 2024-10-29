"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::group.group", ({ strapi }) => ({
  async customMethod(ctx) {
    try {
      const { id } = ctx.params; // Получаем id из параметров
      // Выполняем логику получения данных
      const data = await strapi.entityService.findOne("api::group.group", id);
      ctx.send(data);
    } catch (err) {
      ctx.throw(500, err);
    }
  },
}));
