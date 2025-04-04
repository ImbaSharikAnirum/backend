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
    {
      method: "POST",
      path: "/greenapi/send",
      handler: "greenapi.send",
      config: {
        policies: [],
      },
    },
  ],
};
