"use strict";

/**
 * guide router
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::guide.guide", {
  routes: [
    {
      method: "POST",
      path: "/guides/search-by-text",
      handler: "guide.searchByText",
      config: {
        auth: false, // если хочешь, можешь включить авторизацию
      },
    },
  ],
});
