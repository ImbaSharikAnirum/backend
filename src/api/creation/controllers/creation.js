"use strict";

/**
 * creation controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::creation.creation",
  ({ strapi }) => ({
    async create(ctx) {
      // Извлекаем из тела запроса поле guide для установления связи (ожидается id гайда)
      const { guide } = ctx.request.body;
      const { files } = ctx.request;
      try {
        let imageId = null;

        // Если файлы присутствуют, загружаем изображение через плагин upload
        if (files && files.files) {
          const uploadedFile = await strapi.plugins[
            "upload"
          ].services.upload.upload({
            data: {},
            files: files.files,
          });
          imageId = uploadedFile[0].id; // Получаем ID загруженного файла
        }
        const userId = ctx.state.user ? ctx.state.user.id : null;
        // Формируем данные для создания записи в сущности creation
        const creationData = {
          guide: guide ? { id: guide } : null,
          image: imageId ? imageId : null, // Если изображение загружено, привязываем его
          users_permissions_user: userId ? { id: userId } : null,
        };

        // Создаем новую запись в модели creation с указанными данными
        const newCreation = await strapi.services[
          "api::creation.creation"
        ].create({
          data: creationData,
        });

        return ctx.send(newCreation);
      } catch (error) {
        return ctx.badRequest("Ошибка при создании работы с изображением", {
          error,
        });
      }
    },
  })
);
