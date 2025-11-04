#!/usr/bin/env node

/**
 * Docker Lambda Container Monitor
 * Monitors container health and provides restart capability
 */

const { exec } = require('child_process');
const http = require('http');

function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

async function checkContainerStatus() {
    try {
        const result = await runCommand('docker-compose ps --format json');
        const containers = result.stdout.trim().split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
        
        const lambdaContainer = containers.find(c => c.Service === 'web-automator-lambda');
        return lambdaContainer;
    } catch (error) {
        return null;
    }
}

async function testLambdaHealth() {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            resolve(false);
        }, 10000); // Increased timeout to 10 seconds

        const req = http.request({
            hostname: 'localhost',
            port: 9000,
            path: '/2015-03-31/functions/function/invocations',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timeout);
                // Check for successful response (200-299) and valid JSON response
                resolve(res.statusCode >= 200 && res.statusCode < 300 && data.trim().length > 0);
            });
        });

        req.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });

        req.write(JSON.stringify({
            "url": "https://httpbin.org/status/200",
            "timeout": 5000
        }));
        req.end();
    });
}

async function restartContainer() {
    console.log('🔄 Restarting container...');
    try {
        await runCommand('docker-compose restart web-automator-lambda');
        console.log('✅ Container restarted');
        
        // Wait for container to be ready
        console.log('⏳ Waiting for container to be ready...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        return true;
    } catch (error) {
        console.log('❌ Failed to restart container:', error.error?.message);
        return false;
    }
}

async function main() {
    const command = process.argv[2];

    if (command === '--help' || command === '-h') {
        console.log('Docker Lambda Container Monitor');
        console.log('');
        console.log('Commands:');
        console.log('  status    Check container status and health');
        console.log('  restart   Restart the container');
        console.log('  monitor   Continuously monitor and auto-restart if needed');
        console.log('  test      Quick health test');
        console.log('');
        return;
    }

    if (command === 'status') {
        console.log('📊 Checking container status...');
        
        const container = await checkContainerStatus();
        if (!container) {
            console.log('❌ Container not found');
            console.log('💡 Run: npm run docker:start');
            return;
        }

        console.log(`📦 Container: ${container.Name}`);
        console.log(`🏃 Status: ${container.State}`);
        console.log(`🚀 Ports: ${container.Ports || 'None'}`);

        if (container.State === 'running') {
            console.log('🔍 Testing Lambda health...');
            const healthy = await testLambdaHealth();
            console.log(`💚 Health: ${healthy ? 'Healthy' : 'Unhealthy'}`);
            
            if (!healthy) {
                console.log('💡 Container may need restart: npm run docker:restart');
            }
        }
        return;
    }

    if (command === 'restart') {
        const success = await restartContainer();
        if (success) {
            console.log('🎉 Container is ready for testing');
        }
        return;
    }

    if (command === 'test') {
        console.log('🔍 Quick health test...');
        const healthy = await testLambdaHealth();
        console.log(`Result: ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        return;
    }

    if (command === 'monitor') {
        console.log('👀 Monitoring container health (Ctrl+C to stop)...');
        
        let consecutive_failures = 0;
        const MAX_FAILURES = 3;
        
        const check = async () => {
            const container = await checkContainerStatus();
            const now = new Date().toLocaleTimeString();
            
            if (!container || container.State !== 'running') {
                console.log(`${now} ❌ Container not running`);
                consecutive_failures++;
            } else {
                const healthy = await testLambdaHealth();
                if (healthy) {
                    console.log(`${now} ✅ Healthy`);
                    consecutive_failures = 0;
                } else {
                    console.log(`${now} ⚠️  Health check failed`);
                    consecutive_failures++;
                }
            }
            
            if (consecutive_failures >= MAX_FAILURES) {
                console.log(`${now} 🚨 Too many failures, attempting restart...`);
                const restarted = await restartContainer();
                if (restarted) {
                    consecutive_failures = 0;
                } else {
                    console.log(`${now} 💥 Restart failed, please check manually`);
                }
            }
        };
        
        // Check every 30 seconds
        setInterval(check, 30000);
        await check(); // Initial check
        return;
    }

    // Default: status
    console.log('Docker Lambda Container Monitor');
    console.log('Run with --help for usage information');
}

main().catch(console.error);