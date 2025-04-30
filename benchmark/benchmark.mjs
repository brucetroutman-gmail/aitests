// benchmark.mjs

class Benchmark {
  constructor(name) {
    this.name = name;
    this.results = [];
  }

  async run(fn, iterations = 1) {
    console.log(`Running benchmark: ${this.name}`);
    
    // Warm-up run
    await fn();
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      const duration = end - start;
      this.results.push(duration);
      console.log(`  Iteration ${i + 1}/${iterations}: ${duration.toFixed(2)}ms`);
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
    
    for (const benchmark of sorted) {
      const avg = benchmark.results.reduce((sum, val) => sum + val, 0) / benchmark.results.length;
      const ratio = avg / fastestAvg;
      console.log(`  ${benchmark.name}: ${avg.toFixed(2)}ms (${ratio.toFixed(2)}x ${benchmark === fastest ? 'fastest' : 'slower'})`);
    }
  }
}

export { Benchmark, BenchmarkSuite };
