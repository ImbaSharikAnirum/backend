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
    {
      method: "POST",
      path: "/invoices/tinkoff/notify",
      handler: "invoice.handleTinkoffNotification",
      config: {
        auth: false,
      },
    },
  ],
};
