// duck_sandy_springs_fallback.ts
interface DuckDuckGoResponse {
    AbstractURL: string;
    Results: Array<{ FirstURL: string; Text: string }>;
    RelatedTopics: Array<{ FirstURL?: string; Text: string } | { Topics: Array<{ FirstURL: string; Text: string }> }>;
  }
  
  async function searchDuckDuckGo(query: string): Promise<void> {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
    console.log(`Fetching from: ${url}`);
  
    try {
      const response = await fetch(url);
      const data: DuckDuckGoResponse = await response.json();
      const results = [
        ...(data.Results || []),
        ...(data.RelatedTopics || []).flatMap(item => "Topics" in item ? item.Topics : [item]),
      ].filter((item): item is { FirstURL: string; Text: string } => !!item.FirstURL && !!item.Text);
  
      if (data.AbstractURL) results.unshift({ FirstURL: data.AbstractURL, Text: "Sandy Springs Overview" });
      if (results.length === 0) {
        console.log("No results found.");
        return;
      }
  
      console.log(`Found ${results.length} results. Displaying top 5:`);
      results.slice(0, 5).forEach((result, index) => {
        console.log(`${index + 1}. ${result.Text}`);
        console.log(`   URL: ${result.FirstURL}`);
        console.log("");
      });
    } catch (error) {
      console.error("Error:", error);
    }
  }
  
  const query = "Lexington VA";
  console.log(`Searching DuckDuckGo for: "${query}"`);
  await searchDuckDuckGo(query);