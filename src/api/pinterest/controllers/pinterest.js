const axios = require("axios");
const querystring = require("querystring");
const streamifier = require("streamifier");
const fs = require("fs");
const os = require("os");
const pathModule = require("path");
const generateTagsFromImage = require("../../../utils/generateTagsFromImage");

module.exports = {
  async authenticate(ctx) {
    const { code, userId } = ctx.request.body;
    if (!code || !userId) {
      return ctx.badRequest("Code is required");
    }
    try {
      const authHeader = Buffer.from(
        `${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`
      ).toString("base64");
      const response = await axios.post(
        "https://api.pinterest.com/v5/oauth/token",
        querystring.stringify({
          code: code,
          redirect_uri: process.env.PINTEREST_REDIRECT_URI,
          grant_type: "authorization_code",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${authHeader}`,
          },
        }
      );
      const { access_token, refresh_token } = response.data;
      await strapi.entityService.update(
        "plugin::users-permissions.user",
        userId,
        {
          data: {
            pinterestAccessToken: access_token,
            pinterestRefreshToken: refresh_token || null,
          },
        }
      );

      return ctx.send({ access_token, message: "Токен сохранён" });
    } catch (error) {
      console.error(
        "Ошибка при получении токена: ",
        error.response ? error.response.data : error.message
      );

      ctx.internalServerError("Ошибка при получении токена", error);
    }
  },
  async getPins(ctx) {
    const token = ctx.state.user.pinterestAccessToken; // Получаем токен пользователя
    if (!token) {
      return ctx.unauthorized("Token is required");
    }

    try {
      // Получаем параметры пагинации из запроса
      const pageSize = parseInt(ctx.query.page_size) || 50;
      const bookmark = ctx.query.bookmark || "";

      const url = `https://api.pinterest.com/v5/pins?page_size=${pageSize}${
        bookmark ? `&bookmark=${bookmark}` : ""
      }`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Pinterest API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Получаем гайды из Strapi, чтобы отметить сохранённые пины
      const guides = await strapi.entityService.findMany("api::guide.guide", {
        filters: {
          users_permissions_user: ctx.state.user.id,
          link: { $contains: "https://www.pinterest.com/pin/" },
        },
        fields: ["id", "link"],
        pagination: false,
      });

      // Добавляем флаг isSaved для каждого пина
      const pinsWithSaved = data.items.map((pin) => {
        const pinLink = `https://www.pinterest.com/pin/${pin.id}/`;
        const isSaved = guides.some((guide) => guide.link === pinLink);
        return { ...pin, isSaved };
      });

      return ctx.send({
        items: pinsWithSaved,
        bookmark: data.bookmark || null, // Если bookmark отсутствует, значит, данные закончились
        total: data.total || pinsWithSaved.length, // Общее количество пинов (если возвращается)
      });
    } catch (error) {
      console.error("Ошибка при получении пинов:", error);
      return ctx.internalServerError("Ошибка при получении пинов", {
        error: error.message,
      });
    }
  },
  async savePinterestGuide(ctx) {
    try {
      const {
        imageUrl,
        title,
        text,
        link,
        tags = "",
        approved,
      } = ctx.request.body;

      const tagsFromClient = Array.isArray(tags)
        ? tags.map((t) => String(t).trim().toLowerCase())
        : [];
      // 1. Загрузка изображения
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      const buffer = Buffer.from(response.data, "binary");
      const fileName = imageUrl.split("/").pop();
      const mimeType = response.headers["content-type"];
      const tmpFilePath = pathModule.join(os.tmpdir(), fileName);
      fs.writeFileSync(tmpFilePath, buffer);

      const fileData = {
        name: fileName,
        type: mimeType,
        size: buffer.length,
        path: tmpFilePath,
      };

      const uploadedFiles = await strapi.plugins[
        "upload"
      ].services.upload.upload({
        data: {
          ref: "pinterest-guide",
          refId: null,
          field: "image",
        },
        files: fileData,
      });

      const imageId = uploadedFiles[0].id;

      // 2. Сохраняем гайд без тегов
      const userId = ctx.state.user ? ctx.state.user.id : null;
      const newGuide = await strapi.services["api::guide.guide"].create({
        data: {
          title,
          text,
          link,
          tags: [],
          image: imageId,
          users_permissions_user: userId ? { id: userId } : null,
          approved,
        },
        populate: { image: true },
      });

      // 3. Генерация тегов
      const generatedImageUrl =
        newGuide?.image?.formats?.thumbnail?.url ||
        newGuide?.image?.formats?.medium?.url ||
        newGuide?.image?.url;
      const aiTags = generatedImageUrl
        ? await generateTagsFromImage(generatedImageUrl)
        : [];

      // 4. Получаем текущие теги из гайда и дополняем их
      const existingTags = Array.isArray(newGuide.tags)
        ? newGuide.tags.map((t) => t.trim().toLowerCase())
        : [];

      const combinedTags = [
        ...new Set([...existingTags, ...tagsFromClient, ...aiTags]),
      ];

      // 5. Обновляем гайд с объединёнными тегами
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
      console.error(error);
      ctx.throw(500, error);
    }
  },
};
