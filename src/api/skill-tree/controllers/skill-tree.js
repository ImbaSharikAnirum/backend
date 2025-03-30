"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

// Функция для очистки treeData + выставления completed для guide‑узлов
async function cleanTreeData(strapi, treeData, user) {
  const { id: userId } = user || {};
  const nodes = treeData?.nodes || [];
  const edges = treeData?.edges || [];

  const cleanedNodes = await Promise.all(
    nodes.map(async (node) => {
      const guideId = node?.data?.guideId;

      if (guideId && userId) {
        // Ищем, есть ли creation, связанный с этим guideId и пользователем
        const hasCreation = await strapi.entityService.findMany(
          "api::creation.creation",
          {
            filters: {
              user: userId,
              guide: guideId,
            },
            limit: 1, // только наличие
          }
        );

        if (hasCreation && hasCreation.length > 0) {
          node.data.completed = true;
        }
      }

      return node;
    })
  );

  return {
    nodes: cleanedNodes,
    edges,
  };
}

module.exports = createCoreController(
  "api::skill-tree.skill-tree",
  ({ strapi }) => ({
    // Переопределяем метод получения Skill Tree
    async findOne(ctx) {
      const { id } = ctx.params;
      const user = ctx.state.user;
      const entity = await strapi.entityService.findOne(
        "api::skill-tree.skill-tree",
        id,
        {
          populate: { image: true, author: true, savedBy: true },
        }
      );
      const treeData = entity?.treeData;

      if (treeData && user) {
        entity.treeData = await cleanTreeData(strapi, treeData, user);
      }
      return { entity };
    },

    async create(ctx) {
      const { title, treeData } = ctx.request.body;
      const { files } = ctx.request;
      const userId = ctx.state.user.id; // текущий пользователь

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
        const parsedTreeData = JSON.parse(treeData);

        // Извлекаем id гайдов, скиллов и URL изображений
        const guideIds = [];
        const skillIds = [];
        const imageUrls = [];
        if (parsedTreeData.nodes && Array.isArray(parsedTreeData.nodes)) {
          parsedTreeData.nodes.forEach((node) => {
            if (node.id.startsWith("guide-")) {
              guideIds.push(node.id.replace("guide-", ""));
            } else if (node.id.startsWith("skill-")) {
              skillIds.push(node.id.replace("skill-", ""));
            }
            if (node.data && node.data.imageUrl) {
              imageUrls.push(node.data.imageUrl);
            }
          });
        }

        const skillTreeData = {
          title,
          treeData: parsedTreeData,
          image: imageId ? imageId : null,
          guideIds,
          skillIds,
          imageUrls,
          author: userId,
        };

        const newSkillTree = await strapi.services[
          "api::skill-tree.skill-tree"
        ].create({
          data: skillTreeData,
        });

        const populatedSkillTree = await strapi.entityService.findOne(
          "api::skill-tree.skill-tree",
          newSkillTree.id,
          { populate: ["image"] }
        );
        return ctx.send(populatedSkillTree);
      } catch (error) {
        return ctx.badRequest("Ошибка при создании SkillTree", { error });
      }
    },
    async update(ctx) {
      const { id } = ctx.params;
      const { title, treeData } = ctx.request.body;
      const { files } = ctx.request;
      const userId = ctx.state.user.id;
      const existing = await strapi.entityService.findOne(
        "api::skill-tree.skill-tree",
        id,
        { populate: ["author", "image", "savedBy"] }
      );

      const isSavedOnly =
        ctx.request.body.savedBy && Object.keys(ctx.request.body).length === 1;
      if (existing.author?.id !== userId && !isSavedOnly) {
        return ctx.forbidden("Редактировать может только автор ветки");
      }

      if (isSavedOnly) {
        const updated = await strapi.entityService.update(
          "api::skill-tree.skill-tree",
          id,
          { data: ctx.request.body }
        );
        const populated = await strapi.entityService.findOne(
          "api::skill-tree.skill-tree",
          updated.id,
          { populate: ["savedBy"] }
        );
        return ctx.send({ entity: populated });
      }

      try {
        const parsedTreeData = JSON.parse(treeData);
        const guideIds = [];
        const skillIds = [];
        const imageUrls = [];

        parsedTreeData.nodes?.forEach((node) => {
          if (node.id.startsWith("guide-"))
            guideIds.push(node.id.replace("guide-", ""));
          if (node.id.startsWith("skill-"))
            skillIds.push(node.id.replace("skill-", ""));
          if (node.data?.imageUrl) imageUrls.push(node.data.imageUrl);
        });

        // Собираем данные для обновления
        const updateData = {
          title,
          treeData: parsedTreeData,
          guideIds,
          skillIds,
          imageUrls,
        };

        // Если пришёл новый файл, загружаем его и обновляем поле image
        if (files?.files) {
          const uploaded = await strapi.plugins[
            "upload"
          ].services.upload.upload({
            data: {},
            files: files.files,
          });
          updateData.image = uploaded[0].id;
        }
        // Если файла нет, поле image не передаётся, и старое изображение остаётся без изменений

        const updated = await strapi.services[
          "api::skill-tree.skill-tree"
        ].update(id, {
          data: updateData,
        });

        const populated = await strapi.entityService.findOne(
          "api::skill-tree.skill-tree",
          updated.id,
          { populate: ["image"] }
        );

        return ctx.send(populated);
      } catch (error) {
        return ctx.badRequest("Ошибка при обновлении SkillTree", { error });
      }
    },
  })
);
