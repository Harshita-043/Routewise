import * as cheerio from 'cheerio';

export async function searchWeb(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`Web search failed with status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results = [];
    $('.result__snippet').each((i, element) => {
      if (i < 15) { // Get top 15 snippets for good context
        results.push($(element).text().trim());
      }
    });

    return results.join('\n\n');
  } catch (error) {
    console.error("Live Web Search Error:", error);
    return ""; 
  }
}
