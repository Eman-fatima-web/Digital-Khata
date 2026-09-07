#!/usr/bin/env node
/**
 * Vercel CLI Deployment Script (Cross-Platform)
 * Usage: node deploy.cjs [project-path] [options]
 * Options:
 *   --prod    Deploy to production environment
 *   --yes     Skip confirmation prompts
 * Works on: Windows, macOS, Linux
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const isWindows = os.platform() === 'win32';
// Whitelist of allowed command names to prevent command injection
const ALLOWED_COMMANDS = new Set(['vercel', 'npm', 'pnpm', 'yarn']);
function log(msg) {
  console.error(msg);
}
function commandExists(cmd) {
  if (!ALLOWED_COMMANDS.has(cmd)) {
    throw new Error(`Command not in whitelist: ${cmd}`);
  }
  try {
    if (isWindows) {
      const result = spawnSync('where', [cmd], { stdio: 'ignore' });
      return result.status === 0;
    } else {
      const result = spawnSync('sh', ['-c', `command -v "$1"`, '--', cmd], { stdio: 'ignore' });
      return result.status === 0;
    }
  } catch {
    return false;
  }
}
function getCommandOutput(cmd, args) {
  try {
    const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], shell: isWindows });
    return result.status === 0 ? (result.stdout || '').trim() : null;
  } catch {
    return null;
  }
}
function parseArgs(args) {
  const result = {
    projectPath: '.',
    prod: true,
    yes: false,
    skipBuild: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--prod') {
      result.prod = true;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
    } else if (arg === '--skip-build') {
      result.skipBuild = true;
    } else if (!arg.startsWith('-')) {
      result.projectPath = arg;
    } else {
      log(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }
  return result;
}
function checkVercelInstalled() {
  if (!commandExists('vercel')) {
    log('Error: Vercel CLI is not installed');
    log('Please run install script first to install Vercel CLI');
    process.exit(1);
  }
  const version = getCommandOutput('vercel', ['--version']) || 'unknown';
  log(`Vercel CLI version: ${version}`);
}
function checkLoginStatus() {
  log('Checking login status...');
  try {
    const result = spawnSync('vercel', ['whoami'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: isWindows });
    const output = (result.stdout || '').trim();
    if (result.status === 0 && output && !output.includes('Error') && !output.includes('not logged in')) {
      log(`Logged in as: ${output}`);
      return true;
    }
  } catch {
    // Not logged in
  }
  return false;
}
function checkProject(projectPath) {
  const absPath = path.resolve(projectPath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    log(`Error: Project directory does not exist: ${absPath}`);
    process.exit(1);
  }
  log(`Project path: ${absPath}`);
  const packageJson = path.join(absPath, 'package.json');
  const indexHtml = path.join(absPath, 'index.html');
  if (fs.existsSync(packageJson)) {
    log('Detected package.json');
  } else if (fs.existsSync(indexHtml)) {
    log('Detected static HTML project');
  } else {
    log('Warning: No package.json or index.html detected');
  }
  return absPath;
}
function detectPackageManager(projectPath) {
  // Check lock files to determine package manager
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm';
  // Fallback to checking global availability
  if (commandExists('pnpm')) return 'pnpm';
  if (commandExists('yarn')) return 'yarn';
  if (commandExists('npm')) return 'npm';
  return null;
}
function runBuildIfNeeded(projectPath) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log('No package.json found, skipping build step');
    return true;
  }
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    log(`Warning: Failed to parse package.json: ${error.message}`);
    return true;
  }
  // Check if build script exists
  if (!packageJson.scripts || !packageJson.scripts.build) {
    log('No build script found in package.json, skipping build step');
    return true;
  }
  log('');
  log('========================================');
  log('Running pre-deployment build...');
  log('========================================');
  log('');
  const pkgManager = detectPackageManager(projectPath);
  if (!pkgManager) {
    log('Error: No package manager found (npm/pnpm/yarn)');
    process.exit(1);
  }
  log(`Using package manager: ${pkgManager}`);
  // Check if node_modules exists, if not run install first
  const nodeModulesPath = path.join(projectPath, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log('node_modules not found, installing dependencies first...');
    log('');
    const installArgs = pkgManager === 'yarn' ? [] : ['install'];
    try {
      const result = spawnSync(pkgManager, installArgs, {
        cwd: projectPath,
        stdio: 'inherit',
        shell: isWindows
      });
      if (result.status !== 0) throw new Error('Install failed');
      log('');
      log('Dependencies installed successfully');
    } catch (error) {
      log('');
      log(`Error: Failed to install dependencies`);
      log('Please run install manually and try again');
      process.exit(1);
    }
  }
  // Run build command
  const buildArgs = pkgManager === 'npm' ? ['run', 'build'] : ['build'];
  log(`Executing: ${pkgManager} ${buildArgs.join(' ')}`);
  log('');
  try {
    const result = spawnSync(pkgManager, buildArgs, {
      cwd: projectPath,
      stdio: 'inherit',
      shell: isWindows
    });
    if (result.status !== 0) throw new Error('Build failed');
    log('');
    log('========================================');
    log('Build completed successfully!');
    log('========================================');
    return true;
  } catch (error) {
    log('');
    log('========================================');
    log('Build FAILED!');
    log('========================================');
    log('');
    log('Please fix the build errors before deploying.');
    log('You can run the build manually to see detailed errors:');
    log(`  cd ${projectPath} && ${pkgManager} ${buildArgs.join(' ')}`);
    process.exit(1);
  }
}
function doDeploy(projectPath, options) {
  log('');
  log('Starting deployment...');
  log('');
  const cmdParts = ['vercel'];
  if (options.yes) cmdParts.push('--yes');
  if (options.prod) {
    cmdParts.push('--prod');
    log('Deployment environment: Production (Public)');
  } else {
    log('Deployment environment: Preview');
  }
  const cmd = cmdParts.join(' ');
  log(`Executing command: ${cmd}`);
  log('');
  log('========================================');
  try {
    const args = cmdParts.slice(1);
    const result = spawnSync('vercel', args, {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      timeout: 300000, // 5 minutes timeout
      shell: isWindows
    });
    const output = (result.stdout || '') + (result.stderr || '');
    log(output);
    if (result.status !== 0) {
      throw new Error('Deployment command failed');
    }
    // Extract aliased production URL (public URL without random characters)
    // Format: "Aliased: https://project-name.vercel.app"
    const aliasedMatch = output.match(/Aliased:\s*(https:\/\/[a-zA-Z0-9.-]+\.vercel\.app)/i);
    const productionUrl = aliasedMatch ? aliasedMatch[1] : null;
    // Extract deployment-specific URL as fallback
    // Format: "Production: https://project-xxx.vercel.app"
    const deploymentMatch = output.match(/Production:\s*(https:\/\/[a-zA-Z0-9.-]+\.vercel\.app)/i);
    const deploymentUrl = deploymentMatch ? deploymentMatch[1] : null;
    // Use aliased URL (public) first, fallback to deployment URL
    const finalUrl = productionUrl || deploymentUrl;
    log('');
    log('========================================');
    log('Deployment successful!');
    log('========================================');
    log('');
    if (finalUrl) {
      log(`Your site is live! Visit: ${finalUrl}`);
      log('');
      console.log(JSON.stringify({ status: 'success', url: finalUrl }));
    } else {
      console.log(JSON.stringify({ status: 'success', message: 'Deployment successful' }));
    }
  } catch (error) {
    log(error.message || '');
    log('');
    log('Deployment failed');
    process.exit(1);
  }
}
function main() {
  log('========================================');
  log('Vercel CLI Project Deployment');
  log('========================================');
  log('');
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  checkVercelInstalled();
  log('');
  if (!checkLoginStatus()) {
    log('');
    log('Error: Not logged in');
    log('Please run login script first to authorize');
    process.exit(1);
  }
  log('');
  const projectPath = checkProject(options.projectPath);
  // Run build before deployment (unless skipped)
  if (!options.skipBuild) {
    runBuildIfNeeded(projectPath);
  } else {
    log('Build step skipped (--skip-build flag)');
  }
  doDeploy(projectPath, options);
}
main();
