module.exports = {
  routes: [
    {
      method: "POST",
      path: "/groups/:id/invoice",
      handler: "group-invoices.generateInvoice",
      config: {
        auth: false, // Сделайте auth: true, если нужно ограничить доступ
      },
    },
  ],
};
