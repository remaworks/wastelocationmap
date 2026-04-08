const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// MongoDB connection
const MONGO_HOST = process.env.MONGO_HOST || 'mongodb';
const MONGO_PORT = process.env.MONGO_PORT || '27017';
const MONGO_DB = process.env.MONGO_DB || 'wastelocationmap';
const MONGO_USER = process.env.MONGO_USER || 'root';
const MONGO_PASS = process.env.MONGO_PASS || 'mongodb123';

const mongoUri = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

mongoose.connect(mongoUri).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

// Report Schema
const reportSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    imageUrl: String,
    tags: [String],
    timestamp: Date,
    status: String,
    linkedToId: String,
    folder: String,
    description: String,
    title: String
}, { collection: 'reports' });

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

// Upload folder
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.get('/api/reports', async (req, res) => {
    try {
        const reports = await Report.find().sort({ timestamp: -1 });
        res.json(reports);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/reports', upload.single('image'), async (req, res) => {
    try {
        const { lat, lng, tags, linkedToId, status, folder, description, title } = req.body;
        const newReport = new Report({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
            tags: tags ? JSON.parse(tags) : [],
            timestamp: new Date(),
            status: status || 'Before',
            linkedToId: linkedToId || null,
            folder: folder || '',
            description: description || '',
            title: title || ''
        });
        await newReport.save();
        res.status(201).json(newReport);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/reports/:id', async (req, res) => {
    try {
        const { description, tags, title, folder } = req.body;
        const report = await Report.findByIdAndUpdate(req.params.id, 
            { description, tags, title, folder },
            { new: true }
        );
        if (!report) return res.status(404).json({ error: 'Report not found' });
        res.json(report);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/reports/:id', async (req, res) => {
    try {
        const report = await Report.findByIdAndDelete(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.SERVER_PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));