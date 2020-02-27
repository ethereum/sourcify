#!/usr/bin/env node

const death = require('death');
const Monitor = require('../src/monitor.js');

const monitor = new Monitor({
  repository: 'repository'
});

// Ctrl c
death(function(){
  monitor.stop();
});

console.log("Starting monitor...");
monitor.start();
