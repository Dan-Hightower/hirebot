#!/bin/bash

# Install dependencies
npm install

# Run TypeScript build
npm run build

# Create dist directory if it doesn't exist
mkdir -p dist

# Copy .env to dist
cp .env dist/

# Create credentials directory in dist
mkdir -p dist/credentials

# Copy Google credentials if they exist
if [ -f "credentials/google-creds.json" ]; then
  cp credentials/google-creds.json dist/credentials/
fi

echo "Build complete! Run 'npm start' to start the bot." 