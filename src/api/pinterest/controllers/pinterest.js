const axios = require("axios");

module.exports = {
  async authenticate(ctx) {
    const { code } = ctx.request.body;

    if (!code) {
      return ctx.badRequest("Code is required");
    }
    console.log(code, "code");
    try {
      // Отправка запроса на получение токена доступа от Pinterest
      const response = await axios.post(
        "https://api.pinterest.com/v1/oauth/access_token",
        {
          client_id: `${process.env.PINTEREST_CLIENT_ID}`, // Замените на ваш client_id
          client_secret: `${process.env.PINTEREST_CLIENT_SECRET}`, // Замените на ваш client_secret
          code: code,
          redirect_uri: `${process.env.PINTEREST_REDIRECT_URI}`, // Замените на ваш redirect_uri
        }
      );

      const { access_token } = response.data;
      console.log(response.data, "response");
      if (access_token) {
        // Сохраните токен в базе данных или в другом безопасном месте
        // Например, в переменной сессии или отправьте обратно на фронтенд
        ctx.send({ access_token });
      } else {
        ctx.badRequest("Токен не получен");
      }
    } catch (error) {
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
