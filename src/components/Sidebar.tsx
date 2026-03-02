"use client";

import React, { useEffect, useRef, useState } from "react";
import { Upload, SlidersHorizontal, Layers, FolderOpen, Trash2, CloudDownload, Loader2, Eye, EyeOff, Ruler, Grid, Camera, Hand, MousePointer2 } from "lucide-react";
import { ParsedPart } from "@/lib/stepParser";

/**
 * Data structure representing a previously uploaded STEP file
 * retrievable from the server's local storage.
 */
export interface SavedFile {
    name: string;
    size: number;
    createdAt: string;
    modifiedAt: string;
}

/**
 * Props defining the extensive API surface of the Sidebar.
 * The Sidebar acts as the primary controller for the application state,
 * broadcasting user intents (like toggling modes or sliding values) up to `page.tsx`.
 */
interface SidebarProps {
    onFileUpload: (file: File) => void;
    explodedValue: number;
    onExplodedChange: (val: number) => void;
    globalOpacity: number;
    onGlobalOpacityChange: (val: number) => void;
    measurementMode: boolean;
    onToggleMeasurementMode: () => void;
    parts: ParsedPart[]; // The active list of parsed 3D components
    selectedParts: string[]; // Array of currently highlighted part IDs
    onSelectPart: (id: string, selectMultiple?: boolean) => void;
    onGroupSelected: () => void;
    onLoadSavedFile: (filename: string) => void; // Triggered when a historical file is clicked
    onTogglePartVisibility: (id: string) => void;
    onChangePartColor: (id: string, color: string) => void;
    wireframeMode: boolean;
    onToggleWireframe: () => void;
    onScreenshot: () => void;
    dragMode: boolean;
    onToggleDragMode: () => void;
    boxSelectMode: boolean;
    onToggleBoxSelectMode: () => void;
}

/**
 * The Sidebar Component.
 * Renders the left-hand control panel containing the file uploader,
 * the list of server-saved files, the advanced interaction toggles, and the part hierarchy tree.
 */
export function Sidebar({
    onFileUpload,
    explodedValue,
    onExplodedChange,
    globalOpacity,
    onGlobalOpacityChange,
    measurementMode,
    onToggleMeasurementMode,
    parts,
    selectedParts,
    onSelectPart,
    onGroupSelected,
    onLoadSavedFile,
    onTogglePartVisibility,
    onChangePartColor,
    wireframeMode,
    onToggleWireframe,
    onScreenshot,
    dragMode,
    onToggleDragMode,
    boxSelectMode,
    onToggleBoxSelectMode,
}: SidebarProps) {
    // Internal UI States
    const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const isMountedRef = useRef(false);

    /**
     * Polls the internal Next.js API route to retrieve the list of 
     * STEP files previously uploaded to the server's local file system.
     */
    const fetchFiles = async (signal?: AbortSignal) => {
        if (!isMountedRef.current) return;
        setIsLoadingFiles(true);
        try {
            const res = await fetch('/api/files', { signal });
            if (res.ok) {
                const data = await res.json();
                if (isMountedRef.current) {
                    setSavedFiles(data.files || []);
                }
            }
        } catch (error: unknown) {
            // Ignore abort errors which are expected on fast unmounts
            if (error instanceof Error && error.name === 'AbortError') return;
            console.error("Failed to fetch files", error);
        } finally {
            if (isMountedRef.current) {
                setIsLoadingFiles(false);
            }
        }
    };

    // Auto-fetch the file list when the Sidebar mounts, securely handling unmounts
    useEffect(() => {
        isMountedRef.current = true;
        const controller = new AbortController();
        fetchFiles(controller.signal);

        return () => {
            isMountedRef.current = false;
            controller.abort();
        };
    }, []);

    /**
     * Handles the native HTML file input event.
     * Uploads the file to the local API server for persistence, then 
     * immediately pipes it into the 3D Viewer for processing without a reload.
     */
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];

            setIsUploading(true);

            // Package the file into a standard Multi-Part Form payload for the API
            const formData = new FormData();
            formData.append('file', file);

            try {
                // Post to the Next.js App Router handler
                const res = await fetch('/api/files', {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    await fetchFiles(); // Refresh the visual list of saved files
                    onFileUpload(file); // Trigger the React Three Fiber mount sequence in page.tsx
                } else {
                    alert("Failed to upload file to server.");
                }
            } catch (err) {
                console.error("Upload error", err);
                alert("Error uploading file.");
            } finally {
                setIsUploading(false);
                // Clear the input value so the browser allows selecting the exact same file again if desired
                e.target.value = '';
            }
        }
    };

    /**
     * Stages a file for deletion by setting deleteTarget, which renders the inline confirmation UI.
     */
    const handleDeleteFile = (filename: string) => {
        setDeleteTarget(filename);
    };

    /**
     * Executes the confirmed deletion after the user approves the inline prompt.
     */
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await fetch(`/api/files?name=${encodeURIComponent(deleteTarget)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await fetchFiles();
            } else {
                alert("Failed to delete file.");
            }
        } catch (err) {
            console.error("Delete error", err);
        } finally {
            setDeleteTarget(null);
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

                    {deleteTarget && (
                        <div className="mt-2 p-2 bg-red-950/50 border border-red-700 rounded-md text-xs">
                            <p className="text-red-300 mb-2 truncate">Delete <span className="font-medium">{deleteTarget}</span>?</p>
                            <div className="flex gap-2">
                                <button onClick={confirmDelete} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded">Delete</button>
                                <button onClick={() => setDeleteTarget(null)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 border-b border-slate-700 shrink-0 space-y-4">
                <div>
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

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2" title="Global transparency for inner inspection">
                            Transparency
                        </label>
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">{Math.round((1 - globalOpacity) * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="90"
                        value={(1 - globalOpacity) * 100}
                        onChange={(e) => onGlobalOpacityChange(1 - (Number(e.target.value) / 100))}
                        className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="flex gap-2 w-full mt-2">
                    <button
                        onClick={onToggleMeasurementMode}
                        className={`flex-1 flex items-center justify-center flex-col gap-1 py-2 px-1 rounded-lg cursor-pointer transition-colors text-[10px] font-medium border
                            ${measurementMode ? 'bg-amber-600/20 text-amber-400 border-amber-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        title="Measurement Mode (Click 2 points)"
                    >
                        <Ruler size={14} />
                        Measure
                    </button>
                    <button
                        onClick={onToggleDragMode}
                        className={`flex-1 flex items-center justify-center flex-col gap-1 py-2 px-1 rounded-lg cursor-pointer transition-colors text-[10px] font-medium border
                            ${dragMode ? 'bg-purple-600/20 text-purple-400 border-purple-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        title="Free Move Mode"
                    >
                        <Hand size={14} />
                        Move
                    </button>
                    <button
                        onClick={onToggleBoxSelectMode}
                        className={`flex-1 flex items-center justify-center flex-col gap-1 py-2 px-1 rounded-lg cursor-pointer transition-colors text-[10px] font-medium border
                            ${boxSelectMode ? 'bg-green-600/20 text-green-400 border-green-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        title="Area Selection Mode"
                    >
                        <MousePointer2 size={14} />
                        Area
                    </button>
                </div>

                <div className="flex gap-2 w-full mt-2">
                    <button
                        onClick={onToggleWireframe}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors text-xs font-medium border
                            ${wireframeMode ? 'bg-blue-600/20 text-blue-400 border-blue-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        title="Toggle Wireframe Mode"
                    >
                        <Grid size={14} />
                        Wireframe
                    </button>
                    <button
                        onClick={onScreenshot}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors text-xs font-medium border bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                        title="Download Screenshot"
                    >
                        <Camera size={14} />
                        Capture
                    </button>
                </div>
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
                                    className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors
                                      ${isSelected ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'hover:bg-slate-800 text-slate-300 border border-transparent'}
                                    `}
                                >
                                    <div
                                        className="truncate flex-1 cursor-pointer select-none"
                                        onClick={(e) => onSelectPart(partId, e.ctrlKey || e.metaKey)}
                                    >
                                        {part.name || `Part ${index + 1}`}
                                    </div>

                                    <div className="flex items-center gap-2 ml-2">
                                        <input
                                            type="color"
                                            title="Change part color"
                                            value={part.customColor || `#${part.color.getHexString()}`}
                                            onChange={(e) => onChangePartColor(partId, e.target.value)}
                                            className="w-5 h-5 rounded cursor-pointer shrink-0 border-0 bg-transparent p-0"
                                        />
                                        <button
                                            onClick={() => onTogglePartVisibility(partId)}
                                            className={`p-1 rounded shrink-0 transition-colors ${part.visible ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-400'}`}
                                            title={part.visible ? "Hide part" : "Show part"}
                                        >
                                            {part.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
