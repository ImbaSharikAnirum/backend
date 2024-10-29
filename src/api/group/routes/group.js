"use strict";

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::group.group", {
  routes: [
    {
      method: "GET",
      path: "/groups/:id/custom",
      handler: "group.customMethod",
      config: {
        auth: false, // временно делаем маршрут публичным для тестирования
      },
    },
  ],
});
