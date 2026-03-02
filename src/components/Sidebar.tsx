"use client";

import React, { useEffect, useState } from "react";
import { Upload, SlidersHorizontal, Layers, FolderOpen, Trash2, CloudDownload, Loader2 } from "lucide-react";

export interface SavedFile {
    name: string;
    size: number;
    createdAt: string;
    modifiedAt: string;
}

interface SidebarProps {
    onFileUpload: (file: File) => void;
    explodedValue: number;
    onExplodedChange: (val: number) => void;
    parts: any[];
    selectedParts: string[];
    onSelectPart: (id: string) => void;
    onGroupSelected: () => void;
    onLoadSavedFile: (filename: string) => void;
}

export function Sidebar({
    onFileUpload,
    explodedValue,
    onExplodedChange,
    parts,
    selectedParts,
    onSelectPart,
    onGroupSelected,
    onLoadSavedFile,
}: SidebarProps) {
    const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);

    const fetchFiles = async () => {
        setIsLoadingFiles(true);
        try {
            const res = await fetch('/api/files');
            if (res.ok) {
                const data = await res.json();
                setSavedFiles(data.files || []);
            }
        } catch (error) {
            console.error("Failed to fetch files", error);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];

            // Upload to server then pass to viewer
            setIsUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/api/files', {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    await fetchFiles(); // refresh list
                    onFileUpload(file); // load immediately to viewer
                } else {
                    alert("Failed to upload file to server.");
                }
            } catch (err) {
                console.error("Upload error", err);
                alert("Error uploading file.");
            } finally {
                setIsUploading(false);
                // Reset input so the same file can be uploaded again if needed
                e.target.value = '';
            }
        }
    };

    const handleDeleteFile = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

        try {
            const res = await fetch(`/api/files?name=${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await fetchFiles();
            } else {
                alert("Failed to delete file.");
            }
        } catch (err) {
            console.error("Delete error", err);
        }
    };

    return (
        <div className="w-80 h-full bg-slate-900 text-slate-100 flex flex-col shadow-xl border-r border-slate-700 z-20 overflow-hidden">
            <div className="p-6 border-b border-slate-700 shrink-0">
                <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <Layers className="text-blue-400" />
                    STEP Viewer
                </h1>

                <label className={`flex items-center justify-center gap-2 w-full text-white py-2 px-4 rounded-lg cursor-pointer transition-colors font-medium
          ${isUploading ? 'bg-blue-800 opacity-70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {isUploading ? (
                        <><Loader2 size={18} className="animate-spin" /> Uploading...</>
                    ) : (
                        <><Upload size={18} /> Upload .STEP</>
                    )}
                    <input
                        type="file"
                        accept=".step,.stp"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isUploading}
                    />
                </label>
            </div>

            <div className="p-6 border-b border-slate-700 shrink-0">
                <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 sticky top-0 bg-slate-900 pb-2">
                        <FolderOpen size={16} />
                        Saved Files ({savedFiles.length})
                    </h2>

                    {isLoadingFiles ? (
                        <div className="text-xs text-slate-500 py-2 flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" /> Loading files...
                        </div>
                    ) : savedFiles.length === 0 ? (
                        <div className="text-xs text-slate-500 italic pb-2">No files saved yet.</div>
                    ) : (
                        <ul className="space-y-2">
                            {savedFiles.map((file) => (
                                <li key={file.name} className="flex flex-col bg-slate-800/80 p-2 rounded-md border border-slate-700 group hover:border-slate-500 transition-colors">
                                    <div className="text-xs font-medium truncate mb-1" title={file.name}>{file.name}</div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onLoadSavedFile(file.name)}
                                                className="p-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded"
                                                title="Load in viewer"
                                            >
                                                <CloudDownload size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFile(file.name)}
                                                className="p-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded"
                                                title="Delete from server"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="p-6 border-b border-slate-700 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <SlidersHorizontal size={16} />
                        Exploded View
                    </label>
                    <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">{explodedValue}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={explodedValue}
                    onChange={(e) => onExplodedChange(Number(e.target.value))}
                    className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider sticky top-0 bg-slate-900 pb-1">Parts ({parts.length})</h2>
                    <button
                        onClick={onGroupSelected}
                        disabled={selectedParts.length < 2}
                        className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded transition-colors sticky top-0"
                    >
                        Group Selected
                    </button>
                </div>

                {parts.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm mt-8">
                        No parts loaded. Upload a file to begin.
                    </div>
                ) : (
                    <ul className="space-y-1">
                        {parts.map((part, index) => {
                            const partId = part.id || `part-${index}`;
                            const isSelected = selectedParts.includes(partId);
                            return (
                                <li
                                    key={partId}
                                    onClick={() => onSelectPart(partId)}
                                    className={`px-3 py-2 rounded cursor-pointer text-sm truncate select-none transition-colors
                    ${isSelected ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'hover:bg-slate-800 text-slate-300 border border-transparent'}
                  `}
                                >
                                    {part.name || `Part ${index + 1}`}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
