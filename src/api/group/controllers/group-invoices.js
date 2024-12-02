"use strict";

module.exports = {
  async generateInvoice(ctx) {
    console.log("Привет");
    console.log("Данные из body:", ctx.request.body);
    ctx.send({ message: "Запрос обработан" });
  },
};
