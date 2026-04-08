Write-Host "Installing dependencies..."
npm install --legacy-peer-deps

Write-Host "Installing client dependencies..."
cd client
npm install --legacy-peer-deps
cd ..

Write-Host "Installing server dependencies..."
cd server
npm install --legacy-peer-deps
cd ..

Write-Host "Starting application..."
npm start
