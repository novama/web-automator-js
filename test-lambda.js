#!/usr/bin/env node

/**
 * Simple Docker Lambda Test Script
 * A more reliable way to test the Lambda container
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function testLambdaContainer(testFile = 'basic-test.json') {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout (30s)'));
        }, 30000);

        try {
            const testEventPath = path.join(__dirname, 'tests', 'test-events', testFile);
            if (!fs.existsSync(testEventPath)) {
                clearTimeout(timeout);
                reject(new Error(`Test file not found: ${testEventPath}`));
                return;
            }

            const body = fs.readFileSync(testEventPath, 'utf8');
            
            const req = http.request({
                hostname: 'localhost',
                port: 9000,
                path: '/2015-03-31/functions/function/invocations',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                clearTimeout(timeout);
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.write(body);
            req.end();

        } catch (error) {
            clearTimeout(timeout);
            reject(error);
        }
    });
}

async function main() {
    const testFile = process.argv[2] || 'basic-test.json';
    
    console.log(`🚀 Testing Lambda container with: ${testFile}`);
    console.log('⏱️  Timeout: 30 seconds');
    console.log('');

    try {
        const result = await testLambdaContainer(testFile);
        
        console.log(`📊 Status Code: ${result.statusCode}`);
        
        if (result.statusCode === 200) {
            const data = JSON.parse(result.body);
            console.log('✅ SUCCESS!');
            console.log(`🌐 URL: ${data.data.url}`);
            console.log(`📄 Title: ${data.data.pageTitle}`);
            console.log(`⏱️  Execution Time: ${data.executionTime}ms`);
            
            if (data.data.extractedData?.mainHeading) {
                console.log(`📝 Heading: ${data.data.extractedData.mainHeading}`);
            }
            
            if (data.data.extractedData?.customData?.description) {
                console.log(`📖 Description: ${data.data.extractedData.customData.description.substring(0, 100)}...`);
            }
        } else {
            console.log('❌ ERROR!');
            const errorData = JSON.parse(result.body);
            console.log(`🚨 Error: ${errorData.error?.message || 'Unknown error'}`);
        }

    } catch (error) {
        console.log('💥 FAILED!');
        console.log(`🚨 Error: ${error.message}`);
        
        // Check if container is running
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('   1. Is the container running? Run: docker-compose ps');
        console.log('   2. Check logs: docker-compose logs web-automator-lambda');
        console.log('   3. Restart: npm run docker:start');
        
        process.exit(1);
    }
}

// Show usage if --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node test-lambda.js [test-file]');
    console.log('');
    console.log('Examples:');
    console.log('  node test-lambda.js                    # Uses basic-test.json');
    console.log('  node test-lambda.js basic-test.json    # Test with example.com');
    console.log('');
    process.exit(0);
}

main().catch(console.error);