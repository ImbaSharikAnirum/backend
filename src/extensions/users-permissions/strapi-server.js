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

  // Добавляем middleware для автоматического включения роли в ответы API
  const originalUserController = plugin.controllers.user;

  // Переопределяем метод findOne для добавления роли
  const originalFindOne = originalUserController.findOne;
  originalUserController.findOne = async (ctx) => {
    await originalFindOne(ctx);

    if (ctx.body && ctx.body.id) {
      try {
        // Извлекаем пользователя с ролью
        const userWithExtras = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          ctx.body.id,
          {
            populate: {
              role: true,
              avatar: true,
              photo: true,
            },
          }
        );

        // Добавляем информацию о роли в ответ
        if (userWithExtras) {
          ctx.body.role = userWithExtras.role;
          ctx.body.avatar = userWithExtras.avatar;
          ctx.body.photo = userWithExtras.photo;
        }
      } catch (error) {
        console.error("Error in user findOne middleware:", error);
      }
    }

    return ctx;
  };

  // Переопределяем метод find для добавления роли в списки
  const originalFind = originalUserController.find;
  originalUserController.find = async (ctx) => {
    await originalFind(ctx);

    if (ctx.body && Array.isArray(ctx.body)) {
      try {
        // Для каждого пользователя в списке добавляем роль
        for (let i = 0; i < ctx.body.length; i++) {
          const user = ctx.body[i];
          if (user.id) {
            const userWithExtras = await strapi.entityService.findOne(
              "plugin::users-permissions.user",
              user.id,
              {
                populate: {
                  role: true,
                  avatar: true,
                },
              }
            );

            if (userWithExtras) {
              user.role = userWithExtras.role;
              user.avatar = userWithExtras.avatar;
            }
          }
        }
      } catch (error) {
        console.error("Error in user find middleware:", error);
      }
    }

    return ctx;
  };

  return plugin;
};
