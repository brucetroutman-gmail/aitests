// Note: JavaScript doesn't have a built-in sys.argv equivalent for command line args
// We'll use process.argv instead (Node.js) or you could modify to take input differently
const country = process.argv[2]; // Gets first argument after script name
const mylat = 47.60621;
const mylon = -122.33207;

// Haversine formula implementation (since we can't import haversine directly)
const haversine = (point1, point2, unit = 'mi') => {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    
    const R = unit === 'mi' ? 3958.8 : 6371; // Earth's radius in miles or km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

const schema = {
    city: {
        type: "string",
        description: "Name of the city"
    },
    lat: {
        type: "float",
        description: "Decimal Latitude of the city"
    },
    lon: {
        type: "float",
        description: "Decimal longitude of the city"
    }
};

const payload = {
    model: "llama3",
    messages: [
        {
            role: "system",
            content: `You are a helpful AI assistant. The user will enter a country name and the assistant will return the decimal latitude and decimal longitude of the capital of the country. Output in JSON using the schema defined here: ${JSON.stringify(schema)}.`
        },
        {
            role: "user",
            content: "France"
        },
        {
            role: "assistant",
            content: "{\"city\": \"Paris\", \"lat\": 48.8566, \"lon\": 2.3522}"
        },
        {
            role: "user",
            content: country
        }
    ],
    options: {
        temperature: 0.0
    },
    format: "json",
    stream: false
};

// Using fetch instead of requests
fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
})
.then(response => response.json())
.then(data => {
    const cityinfo = JSON.parse(data.message.content);
    const distance = haversine([mylat, mylon], [cityinfo.lat, cityinfo.lon], 'mi');
    console.log(`Bainbridge Island is about ${Math.round(distance / 10) * 10} miles away from ${cityinfo.city}`);
})
.catch(error => console.error('Error:', error));