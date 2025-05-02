"use strict";

/**
 * group controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const moment = require("moment-timezone");

// Функция для форматирования времени в формат Strapi
const formatTimeForStrapi = (timeString) => {
  if (!timeString) return null;
  // Преобразуем время в формат HH:mm:ss.SSS
  return `${timeString}:00.000`;
};

// Функция для форматирования даты в формат Strapi
const formatDateForStrapi = (dateString) => {
  if (!dateString) return null;
  // Преобразуем дату в формат YYYY-MM-DD
  return dateString;
};

// Функция для конвертации времени в московское время
const convertToMoscowTime = (timeString, timeZone) => {
  if (!timeString || !timeZone) return null;

  // Создаем момент времени с учетом часового пояса
  const timeInZone = moment.tz(timeString, "HH:mm", timeZone);

  // Конвертируем в московское время
  const moscowTime = timeInZone.clone().tz("Europe/Moscow");

  // Форматируем в нужный формат
  return moscowTime.format("HH:mm:ss.SSS");
};

module.exports = createCoreController("api::group.group", ({ strapi }) => ({
  async create(ctx) {
    try {
      const { files } = ctx.request;
      const { data } = ctx.request.body;

      // Парсим JSON данные
      const courseData = JSON.parse(data);

      let imageIds = [];

      // Загружаем все изображения, если они есть
      if (files && files.files) {
        const uploadedFiles = Array.isArray(files.files)
          ? files.files
          : [files.files];

        const uploadPromises = uploadedFiles.map((file) =>
          strapi.plugins["upload"].services.upload.upload({
            data: {},
            files: file,
          })
        );

        const uploadedImages = await Promise.all(uploadPromises);
        imageIds = uploadedImages.flatMap((upload) =>
          upload.map((img) => img.id)
        );
      }

      // Получаем ID текущего пользователя
      const userId = ctx.state.user ? ctx.state.user.id : null;

      // Создаем группу со всеми полями и связями
      const newGroup = await strapi.service("api::group.group").create({
        data: {
          // Основные поля
          description: courseData.description,
          age_start: courseData.age_start,
          age_end: courseData.age_end,
          capacity: courseData.capacity,
          level: courseData.level,
          inventory: courseData.inventory,
          items: courseData.items,
          language: courseData.language,
          price_lesson: courseData.price_lesson,
          time_zone: courseData.time_zone,
          // Форматируем время и даты
          start_time: formatTimeForStrapi(courseData.start_time),
          end_time: formatTimeForStrapi(courseData.end_time),
          start_time_moscow: convertToMoscowTime(
            courseData.start_time,
            courseData.time_zone
          ),
          end_time_moscow: convertToMoscowTime(
            courseData.end_time,
            courseData.time_zone
          ),
          start_day: formatDateForStrapi(courseData.start_day),
          end_day: formatDateForStrapi(courseData.end_day),
          direction: courseData.direction,
          format: courseData.format,
          course_type: courseData.course_type,

          // Дни недели
          monday: courseData.monday,
          tuesday: courseData.tuesday,
          wednesday: courseData.wednesday,
          thursday: courseData.thursday,
          friday: courseData.friday,
          saturday: courseData.saturday,
          sunday: courseData.sunday,

          // Данные о местоположении для оффлайн формата
          country_en: courseData.country_en,
          city_en: courseData.city_en,
          district_en: courseData.district_en,
          administrativeArea_en: courseData.administrativeArea_en,
          route_en: courseData.route_en,
          name_en: courseData.name_en,
          streetNumber_en: courseData.streetNumber_en,

          name_original_language: courseData.name_original_language,
          country_original_language: courseData.country_original_language,
          city_original_language: courseData.city_original_language,
          district_original_language: courseData.district_original_language,
          administrativeArea_original_language:
            courseData.administrativeArea_original_language,
          route_original_language: courseData.route_original_language,
          streetNumber_original_language:
            courseData.streetNumber_original_language,
          original_language: courseData.original_language,

          lat: courseData.lat,
          lng: courseData.lng,
          display_location_name: courseData.display_location_name,

          // Связи
          images: imageIds.length > 0 ? imageIds : undefined,
          teacher: courseData.teacher ? courseData.teacher : undefined,

          // Автоматическая публикация
          publishedAt: new Date(),
        },
        populate: ["images", "teacher"],
      });

      return ctx.send(newGroup);
    } catch (error) {
      console.error("Ошибка при создании группы:", error);
      return ctx.badRequest("Ошибка при создании группы", {
        error: error.message,
      });
    }
  },
}));
