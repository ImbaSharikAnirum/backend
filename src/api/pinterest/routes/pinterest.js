module.exports = {
  routes: [
    {
      method: "GET",
      path: "/pinterest/search",
      handler: "pinterest.searchPins",
      config: {
        policies: [],
      },
    },
  ],
};
