const axios = require("axios");

module.exports = {
  async searchPins(ctx) {
    const { query } = ctx.request.query;

    if (!query) {
      return ctx.badRequest("Query parameter is required");
    }

    try {
      const response = await axios.get(
        `https://api.pinterest.com/v5/search/pins`, // Изучите точный URL в документации
        {
          headers: {
            Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`, // замените на актуальный маркер
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          params: {
            query,
            page_size: 10, // Количество результатов
          },
        }
      );

      return response.data;
    } catch (err) {
      console.error(
        "Error fetching Pinterest data:",
        err.response ? err.response.data : err.message
      );
      return ctx.internalServerError("Failed to fetch data from Pinterest");
    }
  },
};
