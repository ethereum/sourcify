#!/usr/bin/env node
const Monitor = require('../dist/monitor/monitor.js').default;

console.log("Starting monitor...");
const monitor = new Monitor({
    repository: 'repository'
});

monitor.start();
