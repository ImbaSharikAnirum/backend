"use strict";

/**
 * direction controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::direction.direction",
  ({ strapi }) => ({
    async create(ctx) {
      const { title } = ctx.request.body;
      const { files } = ctx.request;
      try {
        let imageId = null;

        if (files && files.files) {
          const uploadedFile = await strapi.plugins[
            "upload"
          ].services.upload.upload({
            data: {},
            files: files.files,
          });
          imageId = uploadedFile[0].id;
        }

        const userId = ctx.state.user ? ctx.state.user.id : null;
        const directionData = {
          title: title,
          image: imageId ? imageId : null,
          users_permissions_user: userId ? { id: userId } : null,
        };

        // Создаем направление
        const newDirection = await strapi.services[
          "api::direction.direction"
        ].create({
          data: directionData,
        });

        // Получаем созданное направление с заполненным полем image
        const populatedDirection = await strapi.entityService.findOne(
          "api::direction.direction",
          newDirection.id,
          { populate: ["image"] }
        );

        return ctx.send(populatedDirection);
      } catch (error) {
        return ctx.badRequest(
          "Ошибка при создании направления с изображением",
          { error }
        );
      }
    },
    async delete(ctx) {
      const { id } = ctx.params;
      // Находим направление с заполненным полем image
      const entity = await strapi.entityService.findOne(
        "api::direction.direction",
        id,
        {
          populate: ["image"],
        }
      );
      if (!entity) {
        return ctx.notFound();
      }

      // Если изображение существует, удаляем его через сервис upload
      if (entity.image) {
        // Если поле image возвращается в виде массива (многие к одному)
        if (Array.isArray(entity.image)) {
          for (const img of entity.image) {
            await strapi.plugins["upload"].services.upload.remove(img);
          }
        } else {
          // Если image – одиночная связь
          await strapi.plugins["upload"].services.upload.remove(entity.image);
        }
      }

      // Удаляем саму запись направления (вызов стандартного метода)
      const response = await super.delete(ctx);
      return response;
    },
  })
);
