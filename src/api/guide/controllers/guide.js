"use strict";

/**
 * guide controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const generateTagsFromImage = require("../../../utils/generateTagsFromImage");

module.exports = createCoreController("api::guide.guide", ({ strapi }) => ({
  async create(ctx) {
    const { title, text, link, approved } = ctx.request.body;
    const { files } = ctx.request;

    let tagsRaw = ctx.request.body.tags;
    let tags = [];

    if (typeof tagsRaw === "string") {
      // Разделяем строку тегов по запятой и пробелу
      tags = tagsRaw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
    }

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

        imageId = uploadedFile[0].id;
      }

      const userId = ctx.state.user ? ctx.state.user.id : null;

      // Создаем черновой гайд
      const newGuide = await strapi.services["api::guide.guide"].create({
        data: {
          title,
          text,
          link,
          tags: [],
          approved,
          image: imageId || null,
          users_permissions_user: userId ? { id: userId } : null,
        },
        populate: { image: true },
      });

      // Генерация тегов по изображению (используем самое маленькое доступное)
      const imageUrl =
        newGuide?.image?.formats?.thumbnail?.url ||
        newGuide?.image?.formats?.small?.url ||
        newGuide?.image?.formats?.medium?.url ||
        newGuide?.image?.formats?.large?.url ||
        newGuide?.image?.url; // fallback к оригиналу

      const aiTags = imageUrl ? await generateTagsFromImage(imageUrl) : [];

      const combinedTags = [...new Set([...tags, ...aiTags])];

      // Обновление тегов в гайде
      const updatedGuide = await strapi.entityService.update(
        "api::guide.guide",
        newGuide.id,
        {
          data: { tags: combinedTags },
          populate: { image: true },
        }
      );

      return ctx.send(updatedGuide);
    } catch (error) {
      console.error("Ошибка при создании гайда:", error);
      return ctx.badRequest("Ошибка при создании гайда", { error });
    }
  },
}));
