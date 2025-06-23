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

    const orderId = invoiceId
      ? `order_invoice_${invoiceId}`
      : `order_${student}_${Date.now()}`;

    const terminalKey = process.env.TINKOFF_TERMINAL_KEY;
    const terminalPassword = process.env.TINKOFF_TERMINAL_PASSWORD;

    const amountInCoins = Math.round(amount * 100);

    // Формируем Receipt для чека (если нужна онлайн-касса)
    const receipt = {
      Email: user.email || "",
      // Phone: user.phone || "",
      Taxation: "usn_income", // заменить при необходимости
      Items: [
        {
          Name: "Курс рисования",
          Price: amountInCoins,
          Quantity: 1,
          Amount: amountInCoins,
          Tax: "none",
        },
      ],
    };

    // Параметры для подписи (только простые значения, без вложенных объектов)
    const paramsForToken = {
      TerminalKey: terminalKey,
      Amount: amountInCoins,
      OrderId: orderId,
      Description: `Оплата курса, студент ${student}`,
    };

    // Функция генерации токена (SHA256) с ключами и значениями, включая Password
    const signParams = (params, password) => {
      const paramsWithPassword = { ...params, Password: password };
      const sortedKeys = Object.keys(paramsWithPassword).sort();
      const valuesString = sortedKeys
        .map((key) => key + paramsWithPassword[key])
        .join("");
      return crypto
        .createHash("sha256")
        .update(valuesString)
        .digest("hex")
        .toUpperCase();
    };

    // Генерация токена
    const token = signParams(paramsForToken, terminalPassword);

    // Формируем окончательный запрос
    const requestData = {
      ...paramsForToken,
      Token: token,
      Customer: {
        Email: user.email || "",
        // Phone: user.phone || "",
      },
      Receipt: receipt,
    };

    try {
      console.log(
        "Отправляем запрос в Тинькофф:",
        JSON.stringify(requestData, null, 2)
      );

      const response = await axios.post(
        "https://securepay.tinkoff.ru/v2/Init",
        requestData
      );

      console.log("Ответ от Тинькофф:", JSON.stringify(response.data, null, 2));

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

  async handleTinkoffNotification(ctx) {
    const body = ctx.request.body;
    const { OrderId, Success, Status } = body;

    console.log("🔔 Уведомление от Tinkoff:", body);

    let invoiceId = null;
    if (OrderId && OrderId.startsWith("order_invoice_")) {
      invoiceId = OrderId.replace("order_invoice_", "");
    }

    try {
      if (Success && Status === "CONFIRMED" && invoiceId) {
        await strapi.entityService.update("api::invoice.invoice", invoiceId, {
          data: {
            status_payment: true,
            paymentId: body.PaymentId || null,
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
