// analyze-data.mjs
import fs from 'fs';
import papa from 'papaparse';
// import stats from 'simple-statistics';
import * as stats from 'simple-statistics';

const consolidatedFile = './consolidated-data.csv';
const batchSize = 10000; // Process 10,000 rows at a time

// Streaming analysis to avoid loading everything into memory
function analyzeData() {
  let headers = [];
  let processedRows = 0;
  let numericColumns = {};
  let columnStats = {};
  
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(consolidatedFile)
      .pipe(papa.parse(papa.NODE_STREAM_INPUT, { header: true }));
    
    let batch = [];
    
    stream.on('data', (row) => {
      if (processedRows === 0) {
        headers = Object.keys(row);
        // Initialize stats containers
        headers.forEach(header => {
          columnStats[header] = {
            sum: 0,
            min: Infinity,
            max: -Infinity,
            count: 0,
            values: [] // For median and percentiles
          };
        });
      }
      
      batch.push(row);
      processedRows++;
      
      // Process batch when it reaches the batch size
      if (batch.length >= batchSize) {
        processBatch(batch, columnStats);
        batch = []; // Clear batch
        console.log(`Processed ${processedRows} rows`);
      }
    });
    
    stream.on('end', () => {
      // Process any remaining rows
      if (batch.length > 0) {
        processBatch(batch, columnStats);
      }
      
      // Calculate final statistics
      const finalStats = {};
      Object.keys(columnStats).forEach(column => {
        const col = columnStats[column];
        
        // Only calculate statistics for numeric columns with enough data
        if (col.count > 0) {
          finalStats[column] = {
            mean: col.sum / col.count,
            min: col.min,
            max: col.max,
            count: col.count
          };
          
          // Calculate median and percentiles for columns with reasonable amounts of data
          if (col.values.length > 0 && col.values.length < 1000000) {
            col.values.sort((a, b) => a - b);
            finalStats[column].median = stats.median(col.values);
            finalStats[column].percentile95 = stats.quantile(col.values, 0.95);
          }
        }
      });
      
      console.log(`Analysis complete. Processed ${processedRows} rows total.`);
      resolve(finalStats);
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

function processBatch(batch, columnStats) {
  batch.forEach(row => {
    Object.keys(row).forEach(column => {
      const value = parseFloat(row[column]);
      if (!isNaN(value)) {
        const stats = columnStats[column];
        stats.sum += value;
        stats.min = Math.min(stats.min, value);
        stats.max = Math.max(stats.max, value);
        stats.count++;
        
        // Store values for median calculation, but limit to avoid memory issues
        if (stats.values.length < 1000000) {
          stats.values.push(value);
        }
      }
    });
  });
}

async function main() {
  try {
    console.log('Starting analysis...');
    const results = await analyzeData();
    
    // Save results to file
    fs.writeFileSync('./analysis-results.json', JSON.stringify(results, null, 2));
    console.log('Analysis results saved to analysis-results.json');
    
    // Print summary
    console.log('\nSummary of key metrics:');
    Object.keys(results).forEach(column => {
      console.log(`\n${column}:`);
      console.log(`  Mean: ${results[column].mean?.toFixed(2) || 'N/A'}`);
      console.log(`  Min: ${results[column].min}`);
      console.log(`  Max: ${results[column].max}`);
      console.log(`  Count: ${results[column].count}`);
    });
  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

main();
