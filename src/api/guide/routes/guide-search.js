module.exports = {
  routes: [
    {
      method: "POST",
      path: "/guides/search-by-text",
      handler: "guide-search.searchByText",
      config: {
        auth: false, // если хочешь, можешь включить авторизацию
      },
    },
  ],
};
