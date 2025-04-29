// promptfoo-commands.mjs
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function exploreCommands() {
  try {
    // Get help output
    console.log('Getting promptfoo help...');
    const { stdout: helpOutput } = await execPromise('npx promptfoo --help');
    console.log('Available promptfoo commands:');
    console.log(helpOutput);
    
    // List all potential commands to try
    const potentialCommands = [
      'npx promptfoo run',
      'npx promptfoo test',
      'npx promptfoo eval',
      'npx promptfoo evaluate',
      'npx promptfoo check'
    ];
    
    // Try each command and see what works
    console.log('\nTrying potential commands:');
    for (const cmd of potentialCommands) {
      try {
        console.log(`\nTrying: ${cmd}`);
        const { stdout } = await execPromise(`${cmd} --help`);
        console.log('Command valid! Help output:');
        console.log(stdout);
      } catch (error) {
        console.log(`Command failed: ${error.message.split('\n')[0]}`);
      }
    }
    
    // Try running with the config file explicitly specified
    console.log('\nTrying with explicit config file:');
    try {
      const { stdout } = await execPromise('npx promptfoo eval --config promptfoo.yaml');
      console.log('Success! Output:');
      console.log(stdout);
    } catch (error) {
      console.log(`Failed with explicit config: ${error.message.split('\n')[0]}`);
      
      // Try creating and running a minimal test
      console.log('\nTrying to create and run a minimal test:');
      await execPromise(`echo "prompts: ['Hello world']\nproviders: ['ollama:gemma2:2b']" > minimal-test.yaml`);
      try {
        const { stdout } = await execPromise('npx promptfoo eval --config minimal-test.yaml');
        console.log('Minimal test succeeded! Output:');
        console.log(stdout);
      } catch (error) {
        console.log(`Minimal test failed: ${error.message.split('\n')[0]}`);
      }
    }
    
  } catch (error) {
    console.error(`Error exploring commands: ${error.message}`);
  }
}

exploreCommands();