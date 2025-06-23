"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const axios = require("axios");
const crypto = require("crypto");

module.exports = createCoreController("api::invoice.invoice", ({ strapi }) => ({
  async createTinkoffPayment(ctx) {
    const {
      users_permissions_user: userId,
      student,
      group,
      amount,
      currency,
    } = ctx.request.body;

    if (!userId) {
      return ctx.throw(400, "User ID is required");
    }

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId
    );

    if (!user) {
      return ctx.throw(404, "User not found");
    }

    const orderId = `order_${student}_${Date.now()}`;

    const terminalKey = process.env.TINKOFF_TERMINAL_KEY;
    const terminalPassword = process.env.TINKOFF_TERMINAL_PASSWORD;

    const amountInCoins = Math.round(amount * 100);
    console.log("user", user);
    const requestData = {
      TerminalKey: terminalKey,
      Amount: amountInCoins,
      OrderId: orderId,
      Description: `Оплата курса, студент ${student}`,
      Customer: {
        Email: user.email || "",
        // Phone: user.phone || "",
      },
    };

    const signParams = (params, password) => {
      const sortedKeys = Object.keys(params).sort();
      const valuesString =
        sortedKeys
          .map((key) => {
            if (typeof params[key] === "object") return "";
            return params[key];
          })
          .join("") + password;
      return crypto
        .createHash("sha256")
        .update(valuesString)
        .digest("hex")
        .toUpperCase();
    };

    requestData.Sign = signParams(requestData, terminalPassword);

    try {
      const response = await axios.post(
        "https://securepay.tinkoff.ru/v2/Init",
        requestData
      );

      if (response.data.Success) {
        ctx.send({
          paymentUrl: response.data.PaymentURL,
          orderId,
          message: "Ссылка на оплату создана",
        });
      } else {
        ctx.throw(400, `Ошибка создания платежа: ${response.data.Message}`);
      }
    } catch (error) {
      console.error("Ошибка Tinkoff Init:", error);
      ctx.throw(500, "Ошибка сервера при создании платежа");
    }
  },
}));
