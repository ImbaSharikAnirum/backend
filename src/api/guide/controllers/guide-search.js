"use strict";
const generateTagsFromText = require("../../../utils/generateTagsFromText");

module.exports = {
  async searchByText(ctx) {
    const { query = "", userId, page = 1, pageSize = 30 } = ctx.request.body;
    const trimmed = query.trim().toLowerCase();

    const filters = { approved: true };

    if (!trimmed) {
      // Пустой запрос — просто approved: true
    } else if (trimmed === "созданные гайды" && userId) {
      filters["users_permissions_user"] = { id: userId };
    } else if (trimmed === "сохраненные" && userId) {
      filters["savedBy"] = { id: userId };
    } else {
      const aiTags = await generateTagsFromText(trimmed);

      if (aiTags.length > 0) {
        filters["$or"] = aiTags.map((tag) => ({
          tags: { $containsi: tag },
        }));
      } else {
        return ctx.send({
          guides: [],
          pagination: { page, pageSize, total: 0 },
        });
      }
    }

    const guides = await strapi.entityService.findPage("api::guide.guide", {
      filters,
      populate: ["image", "savedBy"],
      page,
      pageSize,
    });

    return ctx.send(guides);
  },
};
