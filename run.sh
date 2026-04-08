#!/bin/bash
echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Installing client dependencies..."
cd client
npm install --legacy-peer-deps
cd ..

echo "Installing server dependencies..."
cd server
npm install --legacy-peer-deps
cd ..

echo "Starting application..."
npm start
