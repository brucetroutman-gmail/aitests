// consolidate-data.mjs
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import papa from 'papaparse';
import { Transform } from 'stream';

const inputDir = './csv-files';
const outputFile = './consolidated-data.csv';
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

// Function to check if all files have the same number of columns
async function validateColumnCount(files) {
  let referenceColumnCount = null;
  let referenceHeaders = null;
  let inconsistentFiles = [];

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const parseResult = papa.parse(fileContent, { header: true });
      
      if (parseResult.data.length === 0) {
        console.warn(`Warning: File ${file} appears to be empty`);
        continue;
      }
      
      const columnCount = Object.keys(parseResult.data[0]).length;
      const headers = Object.keys(parseResult.data[0]);
      
      if (referenceColumnCount === null) {
        referenceColumnCount = columnCount;
        referenceHeaders = headers;
      } else if (columnCount !== referenceColumnCount) {
        inconsistentFiles.push({
          file,
          columnCount,
          expectedCount: referenceColumnCount
        });
      }
    } catch (error) {
      console.error(`Error validating ${file}:`, error);
      throw error;
    }
  }

  return {
    isValid: inconsistentFiles.length === 0,
    inconsistentFiles,
    referenceColumnCount,
    referenceHeaders
  };
}

// Process files in batches to avoid memory issues
async function processFilesInBatches(files, referenceHeaders, batchSize = 50) {
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
          delimiter: "\t", // Specify tab delimiter for input files

          complete: function(results) {
            if (!headerWritten && i === 0) {
              writeStream.write(referenceHeaders.join('\t') + '\n');
              headerWritten = true;
            }
            
            results.data.forEach(row => {
              if (Object.values(row).some(val => val !== '')) {
                writeStream.write(Object.values(row).join('\t') + '\n');
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
    
    if (csvFiles.length === 0) {
      console.log('No CSV files found. Nothing to process.');
      return;
    }
    
    // Validate column count consistency
    console.log('Validating column consistency across files...');
    const validationResult = await validateColumnCount(csvFiles);
    
    if (!validationResult.isValid) {
      console.error('ERROR: Files have inconsistent column counts:');
      validationResult.inconsistentFiles.forEach(item => {
        console.error(`  - ${item.file}: has ${item.columnCount} columns (expected ${item.expectedCount})`);
      });
      console.error('Consolidation aborted. Please ensure all CSV files have the same structure.');
      return;
    }
    
    console.log(`All files have consistent column count (${validationResult.referenceColumnCount} columns)`);
    await processFilesInBatches(csvFiles, validationResult.referenceHeaders);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
