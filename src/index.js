"use strict";

const socketIo = require("socket.io");

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    const io = socketIo(strapi.server.httpServer, {
      cors: {
        origin: "http://localhost:3000", // или твой фронт, например: https://myapp.com
        methods: ["GET", "POST"],
      },
    });

    // Сохраняем io глобально
    strapi.io = io;

    io.on("connection", (socket) => {
      console.log("🟢 Новое подключение:", socket.id);

      socket.on("join", (chatId) => {
        console.log(`👤 Клиент ${socket.id} присоединился к чату:`, chatId);
        socket.join(chatId);
      });

      socket.on("leave", (chatId) => {
        console.log(`👋 Клиент ${socket.id} покинул чат:`, chatId);
        socket.leave(chatId);
      });

      socket.on("disconnect", () => {
        console.log("🔴 Отключение клиента:", socket.id);
      });
    });
  },
};
