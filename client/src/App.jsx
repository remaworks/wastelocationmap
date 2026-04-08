import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, LayersControl } from 'react-leaflet';
import Webcam from 'react-webcam';
import axios from 'axios';
import L from 'leaflet';
import { Camera, MapPin, X, Trash, Edit3, Folder } from 'lucide-react';

const API_URL = "http://localhost:5000";

export default function App() {
    const webcamRef = useRef(null);
    const [reports, setReports] = useState([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeLayer, setActiveLayer] = useState('streets');
    const [mapCenter, setMapCenter] = useState([0, 0]);
    const [mapZoom, setMapZoom] = useState(2);
    const [currentView, setCurrentView] = useState('map'); // 'map' or 'gallery'
    const [tagInput, setTagInput] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [editingReport, setEditingReport] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => { fetchReports(); }, []);

    const fetchReports = async () => {
        const res = await axios.get(`${API_URL}/api/reports`);
        setReports(res.data);
    };

    const capture = async () => {
        setLoading(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const imageSrc = webcamRef.current.getScreenshot();

            // Convert Base64 to Blob
            const blob = await fetch(imageSrc).then(res => res.blob());
            const formData = new FormData();
            formData.append('image', blob, 'capture.jpg');
            formData.append('lat', pos.coords.latitude);
            formData.append('lng', pos.coords.longitude);
            formData.append('tags', JSON.stringify(["Mobile-Report"]));

            await axios.post(`${API_URL}/api/reports`, formData);
            fetchReports();
            setLoading(false);
            setIsCameraOpen(false);
        }, () => {
            alert("GPS Required!");
            setLoading(false);
        });
    };

    const updateTags = async (id, currentTags, newTag) => {
        if (!newTag.trim()) return;
        const newTags = [...currentTags, newTag.trim()];
        try {
            await axios.put(`${API_URL}/api/reports/${id}`, { tags: newTags });
            setReports(reports.map(r => r._id === id ? { ...r, tags: newTags } : r));
            setTagInput({ ...tagInput, [id]: '' });
        } catch (e) {
            console.error("Error updating tags", e);
        }
    };

    const removeTag = async (id, currentTags, indexToRemove) => {
        const newTags = currentTags.filter((_, i) => i !== indexToRemove);
        try {
            await axios.put(`${API_URL}/api/reports/${id}`, { tags: newTags });
            setReports(reports.map(r => r._id === id ? { ...r, tags: newTags } : r));
        } catch (e) {
            console.error("Error removing tag", e);
        }
    };

    const deleteReport = async (id) => {
        if (!window.confirm("Are you sure you want to delete this photo forever?")) return;
        try {
            await axios.delete(`${API_URL}/api/reports/${id}`);
            setReports(reports.filter(r => r._id !== id));
        } catch (e) {
            console.error("Error deleting", e);
        }
    };

    const saveReportEdits = async (reportData) => {
        try {
            await axios.put(`${API_URL}/api/reports/${reportData._id}`, reportData);
            setReports(reports.map(r => r._id === reportData._id ? reportData : r));
            setEditingReport(null);
        } catch (e) {
            console.error("Error saving edits", e);
            alert("Failed to save changes.");
        }
    };

    const viewOnMap = (lat, lng) => {
        setCurrentView('map');
        focusMapOn(lat, lng);
    };

    const groupedReports = reports
        .filter(r => {
            const matchesSearch = (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (r.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (r.tags || []).some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesDate = !filterDate || r.timestamp.startsWith(filterDate);
            return matchesSearch && matchesDate;
        })
        .reduce((acc, r) => {
            const folder = r.folder || 'Uncategorized';
            if (!acc[folder]) acc[folder] = [];
            acc[folder].push(r);
            return acc;
        }, {});

    const focusMapOn = (lat, lng) => {
        if (mapRef.current) {
            mapRef.current.invalidateSize(); // Ensure map knows its size before animating
            mapRef.current.setView([lat, lng], 16, { animate: true });
        }
    };

    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

            <header style={{ padding: '1rem', background: '#064e3b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 3000 }}>
                <b style={{ fontSize: '1.2rem' }}>REMA MONITOR</b>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={currentView === 'map' ? toggleBtnActive : toggleBtn} onClick={() => { setCurrentView('map'); setTimeout(() => mapRef.current?.invalidateSize(), 100); }}>Map View</button>
                    <button style={currentView === 'gallery' ? toggleBtnActive : toggleBtn} onClick={() => setCurrentView('gallery')}>Gallery</button>
                </div>
                <span>{reports.length} Points Active</span>
            </header>

            <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                {/* MAP VIEW */}
                <div style={{ position: 'absolute', inset: 0, opacity: currentView === 'map' ? 1 : 0, pointerEvents: currentView === 'map' ? 'auto' : 'none', zIndex: currentView === 'map' ? 10 : 1 }}>
                    <div style={layerSwitcherStyle}>
                        <button style={activeLayer === 'streets' ? { ...layerBtn, ...layerBtnActive } : layerBtn} onClick={() => setActiveLayer('streets')} title="Streets">🗺️</button>
                        <button style={activeLayer === 'satellite' ? { ...layerBtn, ...layerBtnActive } : layerBtn} onClick={() => setActiveLayer('satellite')} title="Satellite">🛰️</button>
                        <button style={activeLayer === 'dark' ? { ...layerBtn, ...layerBtnActive } : layerBtn} onClick={() => setActiveLayer('dark')} title="Dark Theme">🌙</button>
                    </div>

                    <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} zoomControl={false} ref={mapRef}>
                        <TileLayer url={
                            activeLayer === 'streets' ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" :
                            activeLayer === 'satellite' ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" :
                            "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        } />
                        {reports.map(r => (
                            <Marker 
                                key={r._id} 
                                position={[r.lat, r.lng]}
                                eventHandlers={{
                                    click: () => {
                                        setCurrentView('gallery');
                                        setEditingReport(r);
                                    }
                                }}
                            >
                                <Tooltip>
                                    <div style={{ textAlign: 'center' }}>
                                        <img src={r.imageUrl} style={{ width: '120px', borderRadius: '4px', marginBottom: '4px' }} /><br />
                                        <span>{r.title || 'Untitled'} ({(r.tags || []).length} Tags)</span>
                                    </div>
                                </Tooltip>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                {/* GALLERY VIEW */}
                <div style={{ position: 'absolute', inset: 0, opacity: currentView === 'gallery' ? 1 : 0, pointerEvents: currentView === 'gallery' ? 'auto' : 'none', zIndex: currentView === 'gallery' ? 10 : 1, background: '#f8fafc', overflowY: 'auto', padding: '2rem' }}>
                    
                    <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <div style={{ flex: 2, minWidth: '200px' }}>
                            <label style={labelStyle}>Search by Name, Tag, or Description</label>
                            <input 
                                style={inputStyle} 
                                placeholder="Search..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={labelStyle}>Filter by Date</label>
                            <input 
                                type="date" 
                                style={inputStyle} 
                                value={filterDate} 
                                onChange={e => setFilterDate(e.target.value)} 
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button 
                                onClick={() => { setSearchTerm(''); setFilterDate(''); }}
                                style={{ ...viewMapBtn, padding: '10px 15px', background: '#e2e8f0' }}
                            >Reset Filters</button>
                        </div>
                    </div>

                    {reports.length === 0 ? <p style={{ color: '#64748b', textAlign: 'center', marginTop: '3rem' }}>No images captured yet.</p> : null}
                    
                    {Object.keys(groupedReports).length === 0 && reports.length > 0 ? (
                        <p style={{ color: '#64748b', textAlign: 'center', marginTop: '3rem' }}>No results match your filters.</p>
                    ) : null}
                    
                    {Object.entries(groupedReports).map(([folderName, folderReports]) => (
                        <div key={folderName} style={{ marginBottom: '2.5rem' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem' }}>
                                <Folder size={20} /> {folderName} ({folderReports.length})
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                                {folderReports.map(r => (
                                    <div style={galleryCardStyle}>
                                        <div style={{ position: 'relative' }}>
                                            <img src={r.imageUrl} onClick={() => setEditingReport(r)} style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer' }} title="Click to edit" />
                                            <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: '8px', pointerEvents: 'none' }}>
                                                <button onClick={(e) => { e.stopPropagation(); setEditingReport(r); }} style={{...iconBtnStyle, pointerEvents: 'auto'}} title="Edit"><Edit3 size={16} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); deleteReport(r._id); }} style={{ ...iconBtnStyle, color: '#ef4444', pointerEvents: 'auto' }} title="Delete"><Trash size={16} /></button>
                                            </div>
                                        </div>
                                        <div style={{ padding: '1rem 0 0 0' }}>
                                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>{r.title || 'Untitled Image'}</h4>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                                    {new Date(r.timestamp).toLocaleString()}
                                                </p>
                                                <button onClick={() => viewOnMap(r.lat, r.lng)} style={viewMapBtn} title="View on map"><MapPin size={16} /> View Map</button>
                                            </div>
                                            <div style={tagContainerStyle}>
                                                {(r.tags || []).map((t, idx) => (
                                                    <span key={idx} style={tagChipStyle}>{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {!isCameraOpen && (
                <button onClick={() => setIsCameraOpen(true)} style={btnStyle}><Camera /> CAPTURE TRASH</button>
            )}

            {isCameraOpen && (
                <div style={overlayStyle}>
                    <Webcam ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "environment" }} style={{ height: '100%' }} />
                    <div style={controlsStyle}>
                        <button onClick={() => setIsCameraOpen(false)} style={cancelBtn}><X /></button>
                        <button onClick={capture} disabled={loading} style={shutterBtn}>
                            {loading ? "..." : ""}
                        </button>
                    </div>
                </div>
            )}

            {editingReport && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a' }}>Edit Details</h2>
                            <button onClick={() => setEditingReport(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} color="#64748b"/></button>
                        </div>
                        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 300px' }}>
                                <img src={editingReport.imageUrl} style={{ width: '100%', borderRadius: '8px', objectFit: 'cover' }} />
                            </div>
                            <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Title</label>
                                    <input style={inputStyle} value={editingReport.title || ''} onChange={e => setEditingReport({...editingReport, title: e.target.value})} placeholder="Title" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Folder Name</label>
                                    <input style={inputStyle} value={editingReport.folder || ''} onChange={e => setEditingReport({...editingReport, folder: e.target.value})} placeholder="e.g. Site A" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Picture Date & Time</label>
                                    <input 
                                        type="datetime-local" 
                                        style={inputStyle} 
                                        value={editingReport.timestamp ? editingReport.timestamp.substring(0, 16) : ''} 
                                        onChange={e => setEditingReport({...editingReport, timestamp: new Date(e.target.value).toISOString()})} 
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Description</label>
                                    <textarea style={{...inputStyle, minHeight: '100px', resize: 'vertical'}} value={editingReport.description || ''} onChange={e => setEditingReport({...editingReport, description: e.target.value})} placeholder="Add notes here..." />
                                </div>
                                <div>
                                    <label style={labelStyle}>Dynamic Tags</label>
                                    <div style={{...tagContainerStyle, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white'}}>
                                        {(editingReport.tags || []).map((t, idx) => (
                                            <span key={idx} style={tagChipStyle}>
                                                {t} <span style={tagRemoveStyle} onClick={() => {
                                                    const newTags = editingReport.tags.filter((_, i) => i !== idx);
                                                    setEditingReport({...editingReport, tags: newTags});
                                                }}>×</span>
                                            </span>
                                        ))}
                                        <input 
                                            style={{...tagInputStyle, background: 'transparent'}}
                                            placeholder="Type and press Enter..." 
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    const newTag = e.target.value.trim();
                                                    if (newTag) {
                                                        setEditingReport({...editingReport, tags: [...(editingReport.tags || []), newTag]});
                                                        e.target.value = '';
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button style={saveModalBtn} onClick={() => saveReportEdits(editingReport)}>Save Changes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Minimal Inline Styles for Portability
const btnStyle = { position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#10b981', color: 'white', border: 'none', padding: '1rem 2rem', borderRadius: '50px', fontWeight: 'bold', display: 'flex', gap: '10px', cursor: 'pointer' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'black', zIndex: 2000, display: 'flex', flexDirection: 'column' };
const controlsStyle = { position: 'absolute', bottom: '40px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '50px' };
const shutterBtn = { width: '70px', height: '70px', borderRadius: '50%', border: '5px solid white', background: '#ef4444' };
const cancelBtn = { background: 'white', border: 'none', padding: '10px', borderRadius: '50%' };
const layerSwitcherStyle = { position: 'absolute', top: '10px', right: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255, 255, 255, 0.9)', padding: '8px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const layerBtn = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '8px', borderRadius: '6px', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const layerBtnActive = { background: '#e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' };
const galleryCardStyle = { background: 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' };
const tagContainerStyle = { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' };
const tagChipStyle = { background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' };
const tagRemoveStyle = { cursor: 'pointer', opacity: 0.6, fontSize: '1rem', lineHeight: '0.5rem' };
const tagInputStyle = { border: 'none', background: '#f1f5f9', padding: '6px 10px', borderRadius: '12px', fontSize: '0.8rem', outline: 'none', flex: 1, minWidth: '80px' };
const viewMapBtn = { background: '#f1f5f9', color: '#334155', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' };
const toggleBtn = { background: 'transparent', color: '#cbd5e1', border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', outline: 'none', transition: 'all 0.2s' };
const toggleBtnActive = { background: 'white', color: '#064e3b', border: '1px solid white', padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', outline: 'none' };
const iconBtnStyle = { background: 'rgba(255,255,255,0.9)', color: '#334155', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'background 0.2s' };
const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' };
const modalContentStyle = { background: '#f8fafc', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' };
const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'inherit', fontSize: '1rem' };
const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.25rem' };
const saveModalBtn = { background: '#0ea5e9', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' };