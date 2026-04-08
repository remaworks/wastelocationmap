const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // To handle base64 if needed

// Create uploads folder if not exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Configure Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DB (Using local JSON file instead of MongoDB)
const dbFile = './data.json';
let reports = [];
if (fs.existsSync(dbFile)) {
    try {
        reports = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (e) {
        reports = [];
    }
}

const saveReports = () => {
    fs.writeFileSync(dbFile, JSON.stringify(reports, null, 2));
};

// API Routes
app.get('/api/reports', (req, res) => {
    res.json(reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

app.post('/api/reports', upload.single('image'), (req, res) => {
    const { lat, lng, tags } = req.body;
    const newReport = {
        _id: Date.now().toString(),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        imageUrl: `http://localhost:5000/uploads/${req.file.filename}`,
        tags: JSON.parse(tags || "[]"),
        timestamp: new Date().toISOString()
    };
    reports.push(newReport);
    saveReports();
    res.status(201).json(newReport);
});
app.put('/api/reports/:id', (req, res) => {
    const { id } = req.params;
    const { description, tags, title, folder } = req.body;
    
    const reportIndex = reports.findIndex(r => r._id === id);
    if (reportIndex === -1) {
        return res.status(404).json({ error: 'Report not found' });
    }
    
    if (description !== undefined) reports[reportIndex].description = description;
    if (tags !== undefined) reports[reportIndex].tags = tags;
    if (title !== undefined) reports[reportIndex].title = title;
    if (folder !== undefined) reports[reportIndex].folder = folder;
    saveReports();
    res.json(reports[reportIndex]);
});

app.delete('/api/reports/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = reports.length;
    reports = reports.filter(r => r._id !== id);
    if (reports.length === initialLength) {
        return res.status(404).json({ error: 'Report not found' });
    }
    saveReports();
    res.status(204).send();
});

app.listen(5000, () => console.log('🚀 Server running on http://localhost:5000'));