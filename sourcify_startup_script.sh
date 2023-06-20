#!/bin/bash

# Install Docker
sudo yum install -y docker

# Install Git
sudo yum install -y git

# Clone the repository
git clone https://github.com/modularcloud/sourcify.git

# Change to the cloned directory
cd sourcify

# Start Docker service
sudo service docker start

# Build the Docker image
sudo docker build -t sourcify:1.0 -f src/Dockerfile.server .

# Run the Docker container
sudo docker run -d -p 80:5555 sourcify:1.0