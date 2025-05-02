"use strict";
const axios = require("axios");

module.exports = {
  async task({ strapi }) {
    try {
      // Сначала проверяем, есть ли данные в базе
      const existingCurrencies = await strapi.db
        .query("api::currency.currency")
        .findMany();

      // Если данных нет или пришло время обновления, получаем курсы
      if (!existingCurrencies || existingCurrencies.length === 0) {
        strapi.log.info(
          "Данные о валютах отсутствуют. Запускаем обновление..."
        );
      }

      const apiKey = process.env.EXCHANGE_RATE_API_KEY;

      if (!apiKey) {
        strapi.log.error(
          "[cronCurrency] API ключ не найден в переменных окружения"
        );
        return;
      }

      const res = await axios.get(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
      );
      const {
        base_code: base,
        conversion_rates,
        time_last_update_utc,
      } = res.data;

      const updatedAt = new Date(time_last_update_utc);

      const supportedCurrencies = [
        "USD",
        "EUR",
        "GBP",
        "AUD",
        "CAD",
        "JPY",
        "CHF",
        "SEK",
        "NOK",
        "DKK",
        "NZD",
        "SGD",
        "HKD",
        "ZAR",
        "MXN",
        "BRL",
        "INR",
        "CNY",
        "RUB",
        "KRW",
        "TRY",
        "ILS",
        "AED",
        "PLN",
        "CZK",
        "HUF",
        "THB",
        "MYR",
        "IDR",
        "PHP",
        "ARS",
        "CLP",
        "COP",
        "PEN",
        "VND",
        "TWD",
        "SAR",
        "EGP",
        "NGN",
        "PKR",
        "BDT",
        "LKR",
        "KZT",
        "UAH",
        "RON",
        "BGN",
        "HRK",
        "ISK",
        "RSD",
        "MDL",
        "GEL",
        "AZN",
        "BYN",
        "UZS",
        "TMT",
        "AMD",
        "KGS",
        "TJS",
        "MNT",
        "KHR",
        "LAK",
        "MMK",
        "NPR",
        "BND",
        "BHD",
        "OMR",
        "QAR",
        "KWD",
        "JOD",
        "LBP",
        "SYP",
        "IQD",
        "IRR",
        "AFN",
        "MVR",
        "BTN",
        "SCR",
        "MUR",
        "NAD",
        "BWP",
        "ZMW",
      ];

      for (const code of supportedCurrencies) {
        const rate = conversion_rates[code];

        if (typeof rate !== "number") {
          strapi.log.warn(
            `[cronCurrency] Пропущена валюта ${code}: курс не найден или некорректен`
          );
          continue;
        }

        const existing = await strapi.db
          .query("api::currency.currency")
          .findOne({
            where: { code },
          });

        if (existing) {
          await strapi.db.query("api::currency.currency").update({
            where: { id: existing.id },
            data: {
              rate,
              base,
              publishedAt: updatedAt,
            },
          });
        } else {
          await strapi.db.query("api::currency.currency").create({
            data: {
              code,
              rate,
              base,
              publishedAt: updatedAt,
            },
          });
        }
      }

      strapi.log.info(
        `[cronCurrency] Курсы валют ${
          !existingCurrencies || existingCurrencies.length === 0
            ? "созданы"
            : "обновлены"
        }: ${updatedAt.toISOString()}`
      );
    } catch (error) {
      strapi.log.error(
        "[cronCurrency] Ошибка при получении курсов валют:",
        error
      );
    }
  },
};
