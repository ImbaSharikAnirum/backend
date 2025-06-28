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

    // Проверяем обязательные параметры
    if (!amount || !currency) {
      return ctx.throw(
        400,
        "Отсутствуют обязательные параметры: amount, currency"
      );
    }

    // Исправляем запрос к базе данных - используем правильный сервис для поиска пользователя
    let userEmail = "guest@anirum.com"; // Значение по умолчанию

    if (userId) {
      try {
        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { id: userId },
            select: ["email"],
          });

        if (user && user.email) {
          userEmail = user.email;
        }
      } catch (error) {
        console.error("Ошибка при поиске пользователя:", error);
        // Продолжаем с email по умолчанию
      }
    }

    const orderId = invoiceId
      ? `order_invoice_${invoiceId}_${Date.now()}`
      : `order_${student}_${Date.now()}`;

    const terminalKey = process.env.TINKOFF_TERMINAL_KEY?.trim();
    const terminalPassword = process.env.TINKOFF_TERMINAL_PASSWORD?.trim();

    const amountInCoins = Math.round(amount * 100);

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

      const hash = crypto
        .createHash("sha256")
        .update(tokenString)
        .digest("hex");

      return hash;
    };

    const token = generateToken(paramsForToken, terminalPassword);

    const requestData = {
      ...paramsForToken,
      Token: token,
      DATA: {
        Email: userEmail,
      },
      Receipt: {
        Email: userEmail,
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
      console.log("🔄 Отправляем запрос к Tinkoff API:", {
        orderId,
        amount: amountInCoins,
        userEmail,
        invoiceId,
      });

      const apiUrl = "https://securepay.tinkoff.ru/v2/Init";

      const response = await axios.post(apiUrl, requestData, {
        headers: { "Content-Type": "application/json" },
      });

      console.log("✅ Ответ от Tinkoff API:", response.data);

      if (response.data.Success) {
        ctx.send({
          paymentUrl: response.data.PaymentURL,
          orderId,
          message: "Ссылка на оплату создана",
        });
      } else {
        console.error("❌ Ошибка Tinkoff API:", response.data);
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

    // Обновляем извлечение invoiceId для нового формата orderId
    let invoiceId = null;
    if (OrderId?.startsWith("order_invoice_")) {
      // Новый формат: order_invoice_123_1703123456789
      const parts = OrderId.split("_");
      if (parts.length >= 3) {
        invoiceId = parts[2]; // Берем третью часть (invoiceId)
      }
    }

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
      return ctx.throw(500, "Ошибка на сервере при обработке уведомления");
    }
  },
}));
