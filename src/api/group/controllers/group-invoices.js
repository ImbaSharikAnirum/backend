"use strict";

module.exports = {
  async generateInvoice(ctx) {
    const { courseId, month, nextMonth } = ctx.request.body;

    console.log("Получены данные:", {
      courseId,
      currentMonth: month,
      nextMonth,
    });

    try {
      // Получаем счета за текущий месяц
      const currentMonthInvoices = await strapi.entityService.findMany(
        "api::invoice.invoice",
        {
          filters: {
            group: courseId,
            $and: [
              {
                start_day: {
                  $gte: month.startOfMonth,
                  $lte: month.endOfMonth,
                },
              },
            ],
          },
          populate: ["group"],
        }
      );

      console.log("Найдены счета за текущий месяц:", currentMonthInvoices);

      if (!currentMonthInvoices || currentMonthInvoices.length === 0) {
        ctx.throw(404, "Не найдены счета за текущий месяц");
        return;
      }

      // Создаем копии счетов на следующий месяц
      const copiedInvoices = currentMonthInvoices.map(
        ({ name, family, phone, currency }) => ({
          name,
          family,
          phone,
          currency,
          group: courseId,
          status_payment: false,
          start_day: nextMonth.startDayOfMonth,
          end_day: nextMonth.endDayOfMonth,
          sum: nextMonth.sum,
          publishedAt: new Date(),
        })
      );

      console.log("Подготовлены счета на следующий месяц:", copiedInvoices);

      const createdInvoices = await Promise.all(
        copiedInvoices.map((invoice) =>
          strapi.entityService.create("api::invoice.invoice", {
            data: invoice,
          })
        )
      );

      console.log("Созданы новые счета:", createdInvoices);

      ctx.send({
        message: "Счета на следующий месяц успешно созданы",
        count: createdInvoices.length,
        invoices: createdInvoices,
      });
    } catch (error) {
      console.error("Ошибка при создании счетов:", error);
      ctx.throw(500, "Ошибка при обработке запроса");
    }
  },
};
