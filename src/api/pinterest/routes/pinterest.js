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
    {
      method: "POST",
      path: "/pinterest/auth",
      handler: "pinterest.authenticate",
      config: {
        auth: false,
      },
    },
  ],
};
