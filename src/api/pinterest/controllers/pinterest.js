const axios = require("axios");

module.exports = {
  async authenticate(ctx) {
    const { code } = ctx.request.body;

    if (!code) {
      return ctx.badRequest("Code is required");
    }
    console.log(code, "code");
    try {
      // Формируем данные для POST-запроса, используя код авторизации
      const data = new URLSearchParams();
      data.append("grant_type", "authorization_code");
      data.append("client_id", process.env.PINTEREST_CLIENT_ID);
      data.append("client_secret", process.env.PINTEREST_CLIENT_SECRET);
      data.append("code", code);
      data.append("redirect_uri", process.env.PINTEREST_REDIRECT_URI);

      // Отправляем запрос на получение токена
      const response = await axios.post(
        "https://api.pinterest.com/v5/oauth/token",
        data, // Отправляем данные в теле запроса
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded", // Указываем правильный Content-Type
          },
        }
      );

      console.log(response.data, "response");

      // Извлекаем access_token из ответа
      const { access_token } = response.data;

      if (!access_token) {
        return ctx.badRequest("Failed to retrieve access token");
      }

      // Допустим, у вас есть идентификатор пользователя (например, в cookies или через запрос)
      const userId = ctx.state.user.id; // или извлекайте идентификатор пользователя через другую логику

      // Обновляем пользователя с новым токеном
      const user = await strapi.entityService.update("api::user.user", userId, {
        data: { pinterest_token: access_token }, // Сохраняем токен
      });

      return ctx.send({
        message: "Authenticated and token saved successfully",
        user,
        access_token,
      });
    } catch (error) {
      console.error(
        "Pinterest Auth Error:",
        error.response ? error.response.data : error.message
      );
      return ctx.internalServerError("Failed to authenticate");
    }
  },

  async searchPins(ctx) {
    // Получение параметра query из запроса
    const { query } = ctx.request.query;
    console.log("Received query:", query);
    // Если query не указан, возвращаем ошибку
    if (!query) {
      return ctx.badRequest("Query parameter is required");
    }
    console.log("Pinterest Access Token:", process.env.PINTEREST_ACCESS_TOKEN);

    try {
      // Выполняем запрос к Pinterest API
      const response = await axios.get(
        `https://api.pinterest.com/v5/search/pins?query=${query}`, // Используем базовый URL
        {
          headers: {
            Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`, // Замените на ваш валидный токен
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      // Возвращаем данные в контексте Strapi
      return ctx.send(response.data);
      ф;
    } catch (err) {
      console.error(
        "Error fetching Pinterest data:",
        err.response ? err.response.data : err.message
      );
      return ctx.internalServerError("Failed to fetch data from Pinterest");
    }
  },
};
