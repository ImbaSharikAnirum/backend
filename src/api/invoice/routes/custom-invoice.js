"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/invoices/tinkoff/payment",
      handler: "invoice.createTinkoffPayment",
      config: {
        auth: false,
      },
    },
  ],
};
