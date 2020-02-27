#!/usr/bin/env node

const death = require('death');
const Monitor = require('../dist/monitor.js').default;
let config;

const monitor = new Monitor({
  repository: 'repository'
});

if (process.env.TESTING){
  console.log(
    `Monitor will attach to test client: ${process.env.LOCALCHAIN_URL}`
  );

  config = {
    name: 'localhost',
    url: process.env.LOCALCHAIN_URL
  }
}

// Ctrl c
death(function(){
  monitor.stop();
});

console.log("Starting monitor...");

monitor.start(config);
