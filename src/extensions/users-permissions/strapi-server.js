module.exports = (plugin) => {
  const originalAuthController = plugin.controllers.auth.callback;

  plugin.controllers.auth.callback = async (ctx) => {
    await originalAuthController(ctx);
    const userId = ctx.body.user.id; // Получаем ID пользователя из контекста

    // Извлекаем пользователя с ролью
    const userWithExtras = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userId,
      {
        populate: {
          role: true,
          avatar: {
            populate: "*", // Здесь извлекаются все данные из связанной сущности avatar
          },
        },
      }
    );
    // Добавляем информацию о роли в ответ
    ctx.body.user.role = userWithExtras.role;
    ctx.body.user.avatar = userWithExtras.avatar;

    return ctx;
  };

  return plugin;
};
