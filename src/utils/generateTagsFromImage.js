const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function generateTagsFromImage(imageUrl) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an assistant for a drawing tutorial platform. Analyze an image from a tutorial and return 5 to 10 lowercase English tags that clearly describe what is being drawn or demonstrated. Tags should represent objects (e.g. 'hands', 'head'), concepts (e.g. 'perspective', 'volume'), or techniques (e.g. 'shading', 'construction'). Do not include vague or generic terms like 'art', 'drawing', 'illustration', or words about how the tutorial is presented, such as 'step-by-step', 'guide', or 'diagram'. Reply with only a comma-separated list of useful tags.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Generate tags for this image:" },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 100,
    });

    const tagString = response.choices[0].message.content.trim();

    // Преобразуем "eyes, drawing, anatomy" → ["eyes", "drawing", "anatomy"]
    const tags = tagString
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    // console.log("Token usage:", response.usage);

    return tags;
  } catch (err) {
    console.error("Ошибка при генерации тегов:", err);
    return [];
  }
};
