const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const stream = require('stream');

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

let gfs;
mongoose.connect(mongoUri).then(() => {
    console.log('Connected to MongoDB');
    const conn = mongoose.connection;
    gfs = new GridFSBucket(conn.db, { bucketName: 'uploads' });
}).catch(err => console.error('MongoDB connection error:', err));

// Report Schema
const reportSchema = new mongoose.Schema({
    lat: Number,
    lng: Number,
    imageId: mongoose.Schema.Types.ObjectId,
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

// Multer memory storage for GridFS
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Serve images from GridFS
app.get('/uploads/:filename', async (req, res) => {
    try {
        const file = await gfs.find({ filename: req.params.filename }).toArray();
        if (!file.length) return res.status(404).send('File not found');
        
        res.set('Content-Type', file[0].contentType);
        const downloadStream = gfs.openDownloadStream(file[0]._id);
        downloadStream.pipe(res);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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
        
        let imageId = null;
        let imageUrl = '';
        
        if (req.file) {
            const filename = Date.now() + '-' + req.file.originalname;
            const writeStream = gfs.openUploadStream(filename, {
                contentType: req.file.mimetype
            });
            
            const bufferStream = new stream.PassThrough();
            bufferStream.end(req.file.buffer);
            bufferStream.pipe(writeStream);
            
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            
            imageId = writeStream.id;
            imageUrl = `/uploads/${filename}`;
        }
        
        const newReport = new Report({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            imageId,
            imageUrl,
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
        console.error(e);
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
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ error: 'Report not found' });
        
        // Delete image from GridFS
        if (report.imageId) {
            await gfs.delete(report.imageId);
        }
        
        await Report.findByIdAndDelete(req.params.id);
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.SERVER_PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));