const axios = require("axios");
const querystring = require("querystring");

module.exports = {
  async authenticate(ctx) {
    const { code } = ctx.request.body;

    if (!code) {
      return ctx.badRequest("Code is required");
    }
    console.log(code, "code");
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
      console.log(response, "response");
      const { access_token } = response.data;
      if (access_token) {
        ctx.send({ access_token });
      } else {
        ctx.badRequest("Токен не получен");
      }
    } catch (error) {
      console.error(
        "Ошибка при получении токена: ",
        error.response ? error.response.data : error.message
      );

      ctx.internalServerError("Ошибка при получении токена", error);
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
