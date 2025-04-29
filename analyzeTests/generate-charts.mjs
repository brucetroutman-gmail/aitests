// generate-charts.mjs
import fs from 'fs';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

// Load analysis results
const analysisResults = JSON.parse(fs.readFileSync('./analysis-results.json', 'utf8'));

// Configure chart
const width = 800;
const height = 600;
const chartCallback = (ChartJS) => {
  // Optional chart.js plugin config
};

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width, 
  height,
  chartCallback
});

async function generateChart(column, stats) {
  // Simple bar chart showing min, mean, max
  const data = {
    labels: ['Minimum', 'Mean', 'Maximum'],
    datasets: [{
      label: `Statistics for ${column}`,
      data: [stats.min, stats.mean, stats.max],
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 99, 132, 0.6)'
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 99, 132, 1)'
      ],
      borderWidth: 1
    }]
  };

  const configuration = {
    type: 'bar',
    data: data,
    options: {
      plugins: {
        title: {
          display: true,
          text: `${column} Performance Metrics`
        }
      },
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  };

  const image = await chartJSNodeCanvas.renderToBuffer(configuration);
  fs.writeFileSync(`./charts/${column}-chart.png`, image);
  console.log(`Chart for ${column} generated`);
}

async function main() {
  // Create charts directory if it doesn't exist
  if (!fs.existsSync('./charts')) {
    fs.mkdirSync('./charts');
  }
  
  // Generate a chart for each numeric column
  for (const column in analysisResults) {
    const stats = analysisResults[column];
    if (stats.count > 0) {
      await generateChart(column, stats);
    }
  }
  
  console.log('All charts generated successfully');
}

main();
