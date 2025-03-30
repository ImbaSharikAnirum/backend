"use strict";

/**
 * skill controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::skill.skill", ({ strapi }) => ({
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
      const skillData = {
        title: title,
        image: imageId ? imageId : null,
        users_permissions_user: userId ? { id: userId } : null,
      };

      const newSkill = await strapi.services["api::skill.skill"].create({
        data: skillData,
      });

      const populatedSkill = await strapi.entityService.findOne(
        "api::skill.skill",
        newSkill.id,
        { populate: ["image"] }
      );

      return ctx.send(populatedSkill);
    } catch (error) {
      return ctx.badRequest("Ошибка при создании скилла с изображением", {
        error,
      });
    }
  },

  async delete(ctx) {
    const { id } = ctx.params;
    // Находим скилл с заполненным полем image
    const entity = await strapi.entityService.findOne("api::skill.skill", id, {
      populate: ["image"],
    });
    if (!entity) {
      return ctx.notFound();
    }

    if (entity.image) {
      if (Array.isArray(entity.image)) {
        for (const img of entity.image) {
          await strapi.plugins["upload"].services.upload.remove(img);
        }
      } else {
        await strapi.plugins["upload"].services.upload.remove(entity.image);
      }
    }

    const response = await super.delete(ctx);
    return response;
  },
}));
