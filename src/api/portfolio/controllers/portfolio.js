"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::portfolio.portfolio",
  ({ strapi }) => ({
    async create(ctx) {
      try {
        const { files } = ctx.request;
        const user = ctx.state.user;

        let uploadedImageIds = [];

        // Обработка изображений через upload-сервис Strapi
        if (files && files["files.images"]) {
          const uploadedFiles = await strapi.plugins[
            "upload"
          ].services.upload.upload({
            data: {},
            files: files["files.images"],
          });

          uploadedImageIds = uploadedFiles.map((f) => f.id);
        }

        const newPortfolio = await strapi.entityService.create(
          "api::portfolio.portfolio",
          {
            data: {
              users_permissions_user: user ? user.id : null,
              image: uploadedImageIds,
              publishedAt: new Date().toISOString(),
            },
            populate: { image: true },
          }
        );

        return newPortfolio;
      } catch (error) {
        console.error("Ошибка при создании портфолио:", error);
        return ctx.badRequest("Ошибка при создании портфолио", { error });
      }
    },
  })
);
