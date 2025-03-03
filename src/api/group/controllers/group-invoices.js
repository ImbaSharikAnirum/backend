"use strict";

module.exports = {
  async generateInvoice(ctx) {
    const { courseId, month, nextMonth } = ctx.request.body;

    try {
      // Запрос к API Strapi для получения счетов
      const invoices = await strapi.entityService.findMany(
        "api::invoice.invoice",
        {
          filters: {
            group: courseId,
            start_day: { $lte: month?.endOfMonth }, // start_day <= endOfMonth
            end_day: { $gte: month?.startOfMonth }, // end_day >= startOfMonth
          },
        }
      );

      const copiedInvoices = invoices.map(
        ({ name, family, phone, currency }) => ({
          name,
          family,
          phone,
          currency,
          group: courseId,
          status_payment: false,
          start_day: nextMonth?.startDayOfMonth,
          end_day: nextMonth?.endDayOfMonth,
          sum: nextMonth?.sum,
          publishedAt: new Date(),
        })
      );

      const createdInvoices = await Promise.all(
        copiedInvoices.map((invoice) =>
          strapi.entityService.create("api::invoice.invoice", { data: invoice })
        )
      );

      ctx.send({ message: "Копии инвойсов созданы", copiedInvoices });
    } catch (error) {
      console.error("Ошибка при получении инвойсов:", error);
      ctx.send({ error: "Ошибка при обработке запроса" }, 500);
    }
  },
};
