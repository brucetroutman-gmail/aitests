// consolidate-data.mjs
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import papa from 'papaparse';
import { Transform } from 'stream';

const inputDir = './csv-files';
const outputFile = './consolidated-data.csv';
// const headerWritten = false;
let headerWritten = false;

// Create a transform stream to process each chunk
const processingStream = new Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    // Process chunk here if needed
    this.push(chunk);
    callback();
  }
});

// Process files in batches to avoid memory issues
async function processFilesInBatches(files, batchSize = 50) {
  const writeStream = createWriteStream(outputFile);
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(`Processing batch ${i/batchSize + 1}/${Math.ceil(files.length/batchSize)}`);
    
    for (const file of batch) {
      const filePath = path.join(inputDir, file);
      
      await new Promise((resolve, reject) => {
        const readStream = createReadStream(filePath);
        
        papa.parse(readStream, {
          header: true,
          complete: function(results) {
            if (!headerWritten && i === 0) {
              writeStream.write(Object.keys(results.data[0]).join(',') + '\n');
              headerWritten = true;
            }
            
            results.data.forEach(row => {
              if (Object.values(row).some(val => val !== '')) {
                writeStream.write(Object.values(row).join(',') + '\n');
              }
            });
            
            resolve();
          },
          error: function(error) {
            reject(error);
          }
        });
      });
    }
  }
  
  writeStream.end();
  console.log('Consolidation complete!');
}

async function main() {
  try {
    const files = await fs.readdir(inputDir);
    const csvFiles = files.filter(file => path.extname(file).toLowerCase() === '.csv');
    
    console.log(`Found ${csvFiles.length} CSV files to process`);
    await processFilesInBatches(csvFiles);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
