// benchmark.mjs

class Benchmark {
  constructor(name) {
    this.name = name;
    this.results = [];
    this.successes = 0;
    this.iterations = 0;
  }

  async run(fn, iterations = 1) {
    console.log(`Running benchmark: ${this.name}`);
    this.iterations = iterations;
    
    // Warm-up run
    try {
      await fn();
    } catch (error) {
      console.log(`  Warm-up failed: ${error.message}`);
    }
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      let success = false;
      
      try {
        const result = await fn();
        success = result === true || result === undefined ? true : !!result;
        if (success) this.successes++;
      } catch (error) {
        console.log(`  Error in iteration ${i + 1}: ${error.message}`);
      }
      
      const end = performance.now();
      const duration = end - start;
      this.results.push(duration);
      console.log(`  Iteration ${i + 1}/${iterations}: ${duration.toFixed(2)}ms - ${success ? 'Success' : 'Failed'}`);
    }
    
    this.summarize();
    return this.results;
  }
  
  summarize() {
    const sum = this.results.reduce((acc, val) => acc + val, 0);
    const avg = sum / this.results.length;
    const min = Math.min(...this.results);
    const max = Math.max(...this.results);
    
    // Calculate standard deviation
    const variance = this.results.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / this.results.length;
    const stdDev = Math.sqrt(variance);
    
    console.log(`\nResults for ${this.name}:`);
    console.log(`  Iterations: ${this.results.length}`);
    console.log(`  Successes: ${this.successes}/${this.iterations} (${(this.successes / this.iterations * 100).toFixed(1)}%)`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);
    console.log(`  Std Dev: ${stdDev.toFixed(2)}ms`);
  }
}

// For comparing multiple benchmarks
class BenchmarkSuite {
  constructor(name) {
    this.name = name;
    this.benchmarks = [];
  }
  
  add(benchmark) {
    this.benchmarks.push(benchmark);
  }
  
  async runAll(iterations = 1) {
    console.log(`Running benchmark suite: ${this.name}`);
    
    for (const benchmark of this.benchmarks) {
      await benchmark.run(iterations);
      console.log("\n");
    }
    
    this.compare();
  }
  
  compare() {
    if (this.benchmarks.length <= 1) return;
    
    console.log(`Comparison for suite ${this.name}:`);
    
    // Sort benchmarks by average performance
    const sorted = [...this.benchmarks].sort((a, b) => {
      const avgA = a.results.reduce((sum, val) => sum + val, 0) / a.results.length;
      const avgB = b.results.reduce((sum, val) => sum + val, 0) / b.results.length;
      return avgA - avgB;
    });
    
    const fastest = sorted[0];
    const fastestAvg = fastest.results.reduce((sum, val) => sum + val, 0) / fastest.results.length;
    
    console.log("\nPerformance ranking:");
    for (const benchmark of sorted) {
      const avg = benchmark.results.reduce((sum, val) => sum + val, 0) / benchmark.results.length;
      const ratio = avg / fastestAvg;
      console.log(`  ${benchmark.name}: ${avg.toFixed(2)}ms (${ratio.toFixed(2)}x ${benchmark === fastest ? 'fastest' : 'slower'})`);
    }
    
    console.log("\nSuccess rate ranking:");
    const successSorted = [...this.benchmarks].sort((a, b) => {
      return (b.successes / b.iterations) - (a.successes / a.iterations);
    });
    
    for (const benchmark of successSorted) {
      const successRate = benchmark.successes / benchmark.iterations * 100;
      console.log(`  ${benchmark.name}: ${benchmark.successes}/${benchmark.iterations} (${successRate.toFixed(1)}%)`);
    }
  }
}

export { Benchmark, BenchmarkSuite };
