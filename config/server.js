module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  app: {
    keys: env.array("APP_KEYS"),
  },
  webhooks: {
    populateRelations: env.bool("WEBHOOKS_POPULATE_RELATIONS", false),
  },
  url: env("URL"),
  proxy: true,
  cron: {
    enabled: true,
    tasks: {
      "update-currency": {
        task: ({ strapi }) => {
          const cronTask = require("./cron/cronCurrency");
          return cronTask.task({ strapi });
        },
        options: {
          rule: "0 */6 * * *", // Каждые 6 часов
          // rule: "*/1 * * * *", // Каждые 1 минуту
        },
      },
    },
  },
});
