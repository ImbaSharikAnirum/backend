module.exports = {
  routes: [
    {
      method: "POST",
      path: "/greenapi/receive",
      handler: "greenapi.receive",
      config: {
        policies: [],
      },
    },
  ],
};
