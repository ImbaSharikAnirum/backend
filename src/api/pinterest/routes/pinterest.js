module.exports = {
  routes: [
    {
      method: "POST",
      path: "/save-pinterest-guide",
      handler: "pinterest.savePinterestGuide",
      config: {
        policies: [],
      },
    },
    {
      method: "GET",
      path: "/pinterest/get",
      handler: "pinterest.getPins",
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
