
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const answers = req.body;

    const prompt = `
You are GIFTRIO, an expert AI gift recommendation assistant.

Recommend ONE real, specific branded product.

USER PREFERENCES:
Budget: ${answers.budget}
Category: ${answers.category}
Gender: ${answers.gender}
Age: ${answers.age}
Interests: ${answers.interests}

RULES:
1. Recommend one specific product and model.
2. Prefer products available in India.
3. Respect the budget.
4. Do not invent specifications.
5. Suggest three alternative brands.
6. Give a realistic estimated price in INR.
7. Do not claim prices are live verified.
8. Return valid JSON only.

Return exactly this structure:

{
  "name": "Specific product name",
  "brand": "Brand",
  "model": "Model name",
  "description": "Short description",
  "reason": "Why it is suitable",
  "estimatedPrice": "Estimated price in INR",
  "recommendedBrands": ["Brand 1", "Brand 2", "Brand 3"],
  "searchQuery": "Brand and product model"
}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 500
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error?.message || "Gemini API request failed."
      );
    }

    const output = result.candidates?.[0]?.content?.parts
      ?.find(part => part.text)?.text;

    if (!output) {
      throw new Error("Gemini did not generate a recommendation.");
    }

    const gift = JSON.parse(output);

    if (!gift.name || !gift.brand || !gift.model) {
      throw new Error("Incomplete product recommendation.");
    }

    gift.searchQuery = gift.searchQuery ||
      `${gift.brand} ${gift.model}`;

    const search = encodeURIComponent(gift.searchQuery);

    gift.amazonUrl = "https://www.amazon.in/s?k=" + search;
    gift.flipkartUrl = "https://www.flipkart.com/search?q=" + search;

    gift.recommendedBrands =
      Array.isArray(gift.recommendedBrands)
        ? gift.recommendedBrands.slice(0, 3)
        : [];

    return res.status(200).json(gift);

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Something went wrong."
    });
  }
};
