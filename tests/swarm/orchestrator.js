#!/usr/bin/env node

/**
 * QuikAdmin Test Swarm Orchestrator
 * Coordinates multiple specialized testing agents using Claude Flow
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

// Load swarm configuration
const config = require('./swarm-config.json');

class TestSwarmOrchestrator {
  constructor() {
    this.agents = new Map();
    this.results = new Map();
    this.startTime = Date.now();
    this.phase = 'initializing';
  }

  /**
   * Initialize the test swarm
   */
  async initialize() {
    console.log(chalk.cyan.bold('\n🐝 QuikAdmin Test Swarm Initializing...\n'));
    
    // Create results directory
    await fs.mkdir(path.join(__dirname, '../reports'), { recursive: true });
    
    // Initialize agent tracking
    for (const agent of config.agents) {
      this.agents.set(agent.id, {
        ...agent,
        status: 'idle',
        results: null,
        startTime: null,
        endTime: null
      });
    }
    
    console.log(chalk.green(`✅ Initialized ${this.agents.size} specialized agents`));
  }

  /**
   * Execute a testing phase
   */
  async executePhase(phase) {
    console.log(chalk.yellow.bold(`\n📋 Phase: ${phase.name.toUpperCase()}\n`));
    this.phase = phase.name;
    
    const phaseResults = [];
    
    if (phase.parallel) {
      // Execute agents in parallel
      const promises = phase.agents.map(agentId => 
        this.runAgent(agentId, phase)
      );
      phaseResults.push(...await Promise.all(promises));
    } else {
      // Execute agents sequentially
      for (const agentId of phase.agents) {
        const result = await this.runAgent(agentId, phase);
        phaseResults.push(result);
      }
    }
    
    return phaseResults;
  }

  /**
   * Run a specific agent
   */
  async runAgent(agentId, phase) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.error(chalk.red(`❌ Agent ${agentId} not found`));
      return null;
    }
    
    console.log(chalk.blue(`🤖 Starting ${agent.name}...`));
    agent.status = 'running';
    agent.startTime = Date.now();
    
    try {
      let result;
      
      switch (agent.type) {
        case 'orchestrator':
          result = await this.runOrchestrator(agent, phase);
          break;
        case 'tester':
          result = await this.runTester(agent);
          break;
        default:
          result = await this.runGenericAgent(agent);
      }
      
      agent.status = 'completed';
      agent.results = result;
      agent.endTime = Date.now();
      
      const duration = ((agent.endTime - agent.startTime) / 1000).toFixed(2);
      console.log(chalk.green(`✅ ${agent.name} completed in ${duration}s`));
      
      return result;
    } catch (error) {
      agent.status = 'failed';
      agent.error = error.message;
      agent.endTime = Date.now();
      
      console.error(chalk.red(`❌ ${agent.name} failed: ${error.message}`));
      
      if (!phase.continueOnFailure) {
        throw error;
      }
      
      return null;
    }
  }

  /**
   * Run orchestrator tasks
   */
  async runOrchestrator(agent, phase) {
    const results = [];
    
    for (const task of phase.tasks || []) {
      console.log(chalk.gray(`  📌 ${task}`));
      
      switch (task) {
        case 'Initialize test environment':
          await this.initializeTestEnvironment();
          break;
        case 'Setup test database':
          await this.setupTestDatabase();
          break;
        case 'Clear previous test data':
          await this.clearTestData();
          break;
        case 'Aggregate all test results':
          await this.aggregateResults();
          break;
        case 'Generate comprehensive report':
          await this.generateReport();
          break;
        case 'Calculate coverage metrics':
          await this.calculateCoverage();
          break;
        case 'Identify critical issues':
          await this.identifyCriticalIssues();
          break;
      }
      
      results.push({ task, status: 'completed' });
    }
    
    return results;
  }

  /**
   * Run testing agent
   */
  async runTester(agent) {
    const testCommand = this.buildTestCommand(agent);
    
    return new Promise((resolve, reject) => {
      const testProcess = spawn(testCommand.cmd, testCommand.args, {
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TEST_AGENT: agent.id
        }
      });
      
      let output = '';
      let errorOutput = '';
      
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (process.env.VERBOSE) {
          process.stdout.write(chalk.gray(data.toString()));
        }
      });
      
      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        if (process.env.VERBOSE) {
          process.stderr.write(chalk.red(data.toString()));
        }
      });
      
      testProcess.on('close', (code) => {
        const result = {
          agentId: agent.id,
          exitCode: code,
          output,
          errorOutput,
          passed: code === 0,
          stats: this.parseTestOutput(output, agent.config.framework)
        };
        
        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Test failed with exit code ${code}`));
        }
      });
    });
  }

  /**
   * Build test command based on agent configuration
   */
  buildTestCommand(agent) {
    const { framework, parallel } = agent.config;
    
    switch (framework) {
      case 'jest':
        return {
          cmd: 'npx',
          args: [
            'jest',
            agent.testPatterns ? `--testPathPattern="${agent.testPatterns.join('|')}"` : '',
            parallel ? '--maxWorkers=4' : '--maxWorkers=1',
            agent.config.coverage ? '--coverage' : '',
            '--forceExit',
            '--json'
          ].filter(Boolean)
        };
      
      case 'supertest':
        return {
          cmd: 'node',
          args: [path.join(__dirname, `agents/${agent.id}.js`)]
        };
      
      case 'puppeteer':
        return {
          cmd: 'node',
          args: [path.join(__dirname, `agents/${agent.id}.js`)]
        };
      
      default:
        return {
          cmd: 'node',
          args: [path.join(__dirname, `agents/${agent.id}.js`)]
        };
    }
  }

  /**
   * Parse test output based on framework
   */
  parseTestOutput(output, framework) {
    try {
      if (framework === 'jest') {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          return {
            total: data.numTotalTests,
            passed: data.numPassedTests,
            failed: data.numFailedTests,
            skipped: data.numPendingTests,
            duration: data.testResults[0]?.perfStats?.runtime || 0
          };
        }
      }
    } catch (error) {
      console.error(chalk.yellow(`⚠️ Could not parse test output: ${error.message}`));
    }
    
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
  }

  /**
   * Initialize test environment
   */
  async initializeTestEnvironment() {
    // Ensure test database exists
    console.log(chalk.gray('    Setting up test environment...'));
    
    // Check Docker services
    await this.executeCommand('docker-compose ps');
    
    // Ensure required services are running
    const services = ['postgres', 'redis'];
    for (const service of services) {
      const isRunning = await this.checkService(service);
      if (!isRunning) {
        console.log(chalk.yellow(`    Starting ${service}...`));
        await this.executeCommand(`docker-compose up -d ${service}`);
      }
    }
  }

  /**
   * Setup test database
   */
  async setupTestDatabase() {
    console.log(chalk.gray('    Setting up test database...'));
    
    // Run migrations
    await this.executeCommand('npx prisma migrate deploy');
    
    // Seed test data
    await this.executeCommand('npx prisma db seed');
  }

  /**
   * Clear test data
   */
  async clearTestData() {
    console.log(chalk.gray('    Clearing test data...'));
    await this.executeCommand('npx prisma migrate reset --force --skip-seed');
  }

  /**
   * Aggregate all test results
   */
  async aggregateResults() {
    console.log(chalk.gray('    Aggregating results...'));
    
    const summary = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
      agents: []
    };
    
    for (const [id, agent] of this.agents) {
      if (agent.results && agent.results.stats) {
        const stats = agent.results.stats;
        summary.totalTests += stats.total;
        summary.passedTests += stats.passed;
        summary.failedTests += stats.failed;
        summary.skippedTests += stats.skipped;
        summary.totalDuration += stats.duration;
        
        summary.agents.push({
          id,
          name: agent.name,
          status: agent.status,
          stats,
          duration: agent.endTime - agent.startTime
        });
      }
    }
    
    this.summary = summary;
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    console.log(chalk.gray('    Generating report...'));
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        environment: process.env.NODE_ENV || 'test'
      },
      summary: this.summary,
      agents: Array.from(this.agents.values()).map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        duration: agent.endTime - agent.startTime,
        results: agent.results,
        error: agent.error
      })),
      phases: config.execution.phases.map(phase => ({
        name: phase.name,
        status: 'completed' // TODO: Track actual phase status
      }))
    };
    
    // Save JSON report
    const reportPath = path.join(__dirname, '../reports/swarm-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    await fs.writeFile(
      path.join(__dirname, '../reports/swarm-report.md'),
      markdownReport
    );
    
    console.log(chalk.green(`    Report saved to ${reportPath}`));
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    const { summary, metadata } = report;
    const passRate = ((summary.passedTests / summary.totalTests) * 100).toFixed(2);
    
    return `# QuikAdmin Test Swarm Report

## Summary
- **Date**: ${new Date(metadata.timestamp).toLocaleString()}
- **Duration**: ${(metadata.duration / 1000).toFixed(2)}s
- **Environment**: ${metadata.environment}

## Test Results
- **Total Tests**: ${summary.totalTests}
- **Passed**: ${summary.passedTests} ✅
- **Failed**: ${summary.failedTests} ❌
- **Skipped**: ${summary.skippedTests} ⏭️
- **Pass Rate**: ${passRate}%

## Agent Performance
${summary.agents.map(agent => `
### ${agent.name}
- **Status**: ${agent.status}
- **Duration**: ${(agent.duration / 1000).toFixed(2)}s
- **Tests**: ${agent.stats.total} (${agent.stats.passed} passed, ${agent.stats.failed} failed)
`).join('')}

## Recommendations
${this.generateRecommendations(report)}

---
*Generated by QuikAdmin Test Swarm Orchestrator*
`;
  }

  /**
   * Generate recommendations based on results
   */
  generateRecommendations(report) {
    const recommendations = [];
    
    if (report.summary.failedTests > 0) {
      recommendations.push('- Fix failing tests before deployment');
    }
    
    if (report.summary.passedTests / report.summary.totalTests < 0.8) {
      recommendations.push('- Improve test coverage (currently below 80%)');
    }
    
    const slowAgents = report.agents.filter(a => a.duration > 60000);
    if (slowAgents.length > 0) {
      recommendations.push(`- Optimize slow tests: ${slowAgents.map(a => a.name).join(', ')}`);
    }
    
    return recommendations.length > 0 
      ? recommendations.join('\n')
      : '- All tests passing, system ready for deployment ✅';
  }

  /**
   * Calculate coverage metrics
   */
  async calculateCoverage() {
    console.log(chalk.gray('    Calculating coverage...'));
    
    try {
      const coverageData = await fs.readFile(
        path.join(__dirname, '../../coverage/coverage-summary.json'),
        'utf-8'
      );
      
      const coverage = JSON.parse(coverageData);
      this.coverage = coverage;
    } catch (error) {
      console.log(chalk.yellow('    No coverage data available'));
    }
  }

  /**
   * Identify critical issues
   */
  async identifyCriticalIssues() {
    console.log(chalk.gray('    Identifying critical issues...'));
    
    const issues = [];
    
    // Check for security test failures
    const securityAgent = this.agents.get('security-tester');
    if (securityAgent && securityAgent.status === 'failed') {
      issues.push({
        severity: 'critical',
        type: 'security',
        message: 'Security tests failed - potential vulnerabilities detected'
      });
    }
    
    // Check for authentication failures
    const apiAgent = this.agents.get('api-tester');
    if (apiAgent && apiAgent.results && apiAgent.results.stats.failed > 0) {
      issues.push({
        severity: 'high',
        type: 'api',
        message: 'API tests failing - authentication or endpoints may be broken'
      });
    }
    
    this.criticalIssues = issues;
    
    if (issues.length > 0) {
      console.log(chalk.red(`    Found ${issues.length} critical issues!`));
    }
  }

  /**
   * Execute a shell command
   */
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, [], { shell: true });
      
      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed: ${command}`));
        }
      });
    });
  }

  /**
   * Check if a service is running
   */
  async checkService(service) {
    try {
      const output = await this.executeCommand(`docker-compose ps ${service}`);
      return output.includes('Up');
    } catch {
      return false;
    }
  }

  /**
   * Run the complete test swarm
   */
  async run() {
    try {
      await this.initialize();
      
      console.log(chalk.cyan.bold('\n🚀 Starting Test Swarm Execution\n'));
      
      // Execute each phase
      for (const phase of config.execution.phases) {
        await this.executePhase(phase);
      }
      
      // Final summary
      const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
      console.log(chalk.cyan.bold(`\n✨ Test Swarm Completed in ${duration}s\n`));
      
      if (this.summary) {
        const passRate = ((this.summary.passedTests / this.summary.totalTests) * 100).toFixed(2);
        console.log(chalk.white.bold('📊 Results Summary:'));
        console.log(chalk.green(`  ✅ Passed: ${this.summary.passedTests}`));
        console.log(chalk.red(`  ❌ Failed: ${this.summary.failedTests}`));
        console.log(chalk.yellow(`  ⏭️  Skipped: ${this.summary.skippedTests}`));
        console.log(chalk.cyan(`  📈 Pass Rate: ${passRate}%`));
        
        if (this.criticalIssues && this.criticalIssues.length > 0) {
          console.log(chalk.red.bold('\n⚠️  Critical Issues:'));
          this.criticalIssues.forEach(issue => {
            console.log(chalk.red(`  - ${issue.message}`));
          });
        }
      }
      
    } catch (error) {
      console.error(chalk.red.bold(`\n❌ Test Swarm Failed: ${error.message}\n`));
      process.exit(1);
    }
  }
}

// Check if chalk is installed
try {
  require.resolve('chalk');
} catch {
  console.log('Installing required dependencies...');
  require('child_process').execSync('npm install chalk', { stdio: 'inherit' });
}

// Run the orchestrator
if (require.main === module) {
  const orchestrator = new TestSwarmOrchestrator();
  orchestrator.run();
}

module.exports = TestSwarmOrchestrator;