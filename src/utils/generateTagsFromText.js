const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function generateTagsFromText(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты помощник на платформе по рисованию. Пользователь вводит запрос. Выдели 3–5 простых и понятных тегов на английском языке для поиска по гайдам. Не используй общие или составные фразы вроде 'drawing basics', 'art tutorial', 'light and shadow'. Лучше укажи отдельные понятия, например: hand, shadow, anatomy. Ответь только списком через запятую.",
        },
        { role: "user", content: text },
      ],
      max_tokens: 50,
    });
    // console.log("📊 Токены:", response.usage);

    const content = response.choices[0].message.content;

    const tags = content
      .split(",")
      .map((tag) => tag.replace(/^['"\s]+|['"\s]+$/g, "").toLowerCase())
      .filter(Boolean);
    console.log("📊 tags:", tags);
    return tags;
  } catch (error) {
    r;
    console.error("❌ Ошибка при генерации тегов из текста:", error);
    return [];
  }
};
