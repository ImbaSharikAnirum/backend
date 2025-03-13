const axios = require("axios");
const querystring = require("querystring");
const streamifier = require("streamifier");
const fs = require("fs");
const os = require("os");
const pathModule = require("path");

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
      let allPins = [];
      let bookmark = null;

      // Выполняем запросы, пока API возвращает bookmark
      do {
        const url = `https://api.pinterest.com/v5/pins/?limit=100${
          bookmark ? `&bookmark=${bookmark}` : ""
        }`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`, // Передаем токен
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });
        const data = await response.json();

        if (data && data.items && Array.isArray(data.items)) {
          allPins = allPins.concat(data.items);
        }

        // Если bookmark присутствует, значит, есть следующая порция данных
        bookmark = data.bookmark;
      } while (bookmark);
      console.log(`Получено ${allPins.length} пинов из Pinterest.`);

      // Получаем гайды из Strapi, чтобы отметить сохранённые пины
      const guides = await strapi.entityService.findMany("api::guide.guide", {
        filters: {
          users_permissions_user: ctx.state.user.id,
          link: { $contains: "https://www.pinterest.com/pin/" },
        },
        fields: ["id", "link"],
        pagination: false,
      });

      // Для каждого пина добавляем флаг isSaved, если ссылка пина совпадает с сохранённым гайдом
      const pinsWithSaved = allPins.map((pin) => {
        const pinLink = `https://www.pinterest.com/pin/${pin.id}/`;
        const isSaved = guides.some((guide) => guide.link === pinLink);
        return { ...pin, isSaved };
      });

      // Возвращаем все пины в одном объекте
      return ctx.send({ items: pinsWithSaved });
    } catch (error) {
      console.error("Ошибка при получении пинов:", error);
      return ctx.internalServerError("Ошибка при получении пинов", error);
    }
  },

  async savePinterestGuide(ctx) {
    try {
      const { imageUrl, title, text, link, tags, approved } = ctx.request.body;
      let imageId = null;
      // Загружаем изображение по URL
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      const buffer = Buffer.from(response.data, "binary");

      // Извлекаем имя файла и MIME-тип
      const fileName = imageUrl.split("/").pop();
      const mimeType = response.headers["content-type"];

      // Сохраняем буфер во временный файл
      const tmpFilePath = pathModule.join(os.tmpdir(), fileName);
      fs.writeFileSync(tmpFilePath, buffer);

      // Формируем объект для загрузки с указанным путём
      const fileData = {
        name: fileName,
        type: mimeType,
        size: buffer.length,
        path: tmpFilePath, // здесь передаем корректный путь к файлу
      };

      // Загружаем файл через плагин upload Strapi
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
      imageId = uploadedFiles[0].id;
      const userId = ctx.state.user ? ctx.state.user.id : null;
      const guideData = {
        title,
        text,
        link,
        tags,
        image: imageId ? imageId : null, // Если изображение загружено, привязываем его
        users_permissions_user: userId ? { id: userId } : null,
        approved: approved,
      };

      // Если хотите протестировать, просто отправьте ответ
      const newGuide = await strapi.services["api::guide.guide"].create({
        data: guideData,
      });

      return ctx.send(newGuide);
    } catch (error) {
      console.error(error);
      ctx.throw(500, error);
    }
  },
};
