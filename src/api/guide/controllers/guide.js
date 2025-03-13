"use strict";

/**
 * guide controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::guide.guide", ({ strapi }) => ({
  async create(ctx) {
    const { title, text, link, tags, approved } = ctx.request.body; // Просто используем данные напрямую
    const { files } = ctx.request;
    try {
      let imageId = null;

      // Проверяем, есть ли файлы и если да, загружаем изображение
      if (files && files.files) {
        const uploadedFile = await strapi.plugins[
          "upload"
        ].services.upload.upload({
          data: {},
          files: files.files,
        });

        imageId = uploadedFile[0].id; // Получаем ID загруженного изображения
      }
      const userId = ctx.state.user ? ctx.state.user.id : null;
      // Создаем новый гайд с привязанным изображением, если оно есть
      const guideData = {
        title,
        text,
        link,
        tags,
        approved,
        image: imageId ? imageId : null, // Если изображение загружено, привязываем его
        users_permissions_user: userId ? { id: userId } : null,
      };

      const newGuide = await strapi.services["api::guide.guide"].create({
        data: guideData,
      });

      return ctx.send(newGuide);
    } catch (error) {
      return ctx.badRequest("Ошибка при создании гайда с изображением", {
        error,
      });
    }
  },
}));
