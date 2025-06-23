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
      invoiceId,
    } = ctx.request.body;

    if (!userId) return ctx.throw(400, "User ID is required");

    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId
    );
    if (!user) return ctx.throw(404, "User not found");

    const orderId = invoiceId
      ? `order_invoice_${invoiceId}`
      : `order_${student}_${Date.now()}`;

    const terminalKey = process.env.TINKOFF_TERMINAL_KEY?.trim();
    const terminalPassword = process.env.TINKOFF_TERMINAL_PASSWORD?.trim();
    const amountInCoins = Math.round(amount * 100);

    console.log(
      "🔐 TerminalKey:",
      `"${terminalKey}"`,
      `length: ${terminalKey.length}`
    );
    console.log(
      "🔐 TerminalPassword:",
      `"${terminalPassword}"`,
      `length: ${terminalPassword.length}`
    );

    const paramsForToken = {
      TerminalKey: terminalKey,
      Amount: amountInCoins,
      OrderId: orderId,
      Description: `Оплата курса`,
    };

    const generateToken = (params, password) => {
      const tokenParams = { ...params, Password: password };
      const sortedKeys = Object.keys(tokenParams).sort();

      const tokenString = sortedKeys.map((key) => tokenParams[key]).join("");

      console.log("🔐 Sorted keys for token:", sortedKeys);
      console.log("🔐 Token string before hash (raw):", tokenString);

      const hash = crypto
        .createHash("sha256")
        .update(tokenString)
        .digest("hex")
        .toUpperCase();

      console.log("🔐 Generated Token:", hash);
      return hash;
    };

    const token = generateToken(paramsForToken, terminalPassword);

    const requestData = {
      ...paramsForToken,
      Token: token,
      DATA: {
        Email: user.email,
      },
      Receipt: {
        Email: user.email,
        Taxation: "usn_income",
        Items: [
          {
            Name: "Курс рисования",
            Price: amountInCoins,
            Quantity: 1,
            Amount: amountInCoins,
            Tax: "none",
          },
        ],
      },
    };

    try {
      const apiUrl = "https://securepay.tinkoff.ru/v2/Init";
      console.log("📡 Отправка запроса в Tinkoff URL:", apiUrl);
      console.log("📦 Request body:", JSON.stringify(requestData, null, 2));

      const response = await axios.post(apiUrl, requestData, {
        headers: { "Content-Type": "application/json" },
      });

      console.log(
        "📥 Ответ от Tinkoff:",
        JSON.stringify(response.data, null, 2)
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
      console.error(
        "❌ Ошибка Tinkoff Init:",
        error.response?.data || error.message
      );
      ctx.throw(500, "Ошибка сервера при создании платежа");
    }
  },

  async handleTinkoffNotification(ctx) {
    const { OrderId, Success, Status, PaymentId } = ctx.request.body;

    console.log("🔔 Уведомление от Tinkoff:", ctx.request.body);

    const invoiceId = OrderId?.startsWith("order_invoice_")
      ? OrderId.replace("order_invoice_", "")
      : null;

    try {
      if (Success && Status === "CONFIRMED" && invoiceId) {
        await strapi.entityService.update("api::invoice.invoice", invoiceId, {
          data: {
            status_payment: true,
            paymentId: PaymentId || null,
            paymentDate: new Date(),
          },
        });
        return ctx.send({ status: "ok" });
      } else {
        console.log(
          "❌ Платеж не подтвержден или не найден invoiceId:",
          Status
        );
        return ctx.send({ status: "Payment not confirmed" });
      }
    } catch (err) {
      console.error("Ошибка при обработке уведомления:", err);
      return ctx.throw(500, "Ошибка на сервере при обработке уведомления");
    }
  },
}));
