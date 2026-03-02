"use client";

import React from "react";
import { Upload, SlidersHorizontal, Layers } from "lucide-react";

interface SidebarProps {
    onFileUpload: (file: File) => void;
    explodedValue: number;
    onExplodedChange: (val: number) => void;
    parts: any[];
    selectedParts: string[];
    onSelectPart: (id: string) => void;
    onGroupSelected: () => void;
}

export function Sidebar({
    onFileUpload,
    explodedValue,
    onExplodedChange,
    parts,
    selectedParts,
    onSelectPart,
    onGroupSelected,
}: SidebarProps) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileUpload(e.target.files[0]);
        }
    };

    return (
        <div className="w-80 h-full bg-slate-900 text-slate-100 flex flex-col shadow-xl border-r border-slate-700 z-20">
            <div className="p-6 border-b border-slate-700">
                <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
                    <Layers className="text-blue-400" />
                    STEP Viewer
                </h1>

                <label className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg cursor-pointer transition-colors font-medium">
                    <Upload size={18} />
                    <span>Upload .STEP</span>
                    <input
                        type="file"
                        accept=".step,.stp"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </label>
            </div>

            <div className="p-6 border-b border-slate-700">
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

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Parts ({parts.length})</h2>
                    <button
                        onClick={onGroupSelected}
                        disabled={selectedParts.length < 2}
                        className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded transition-colors"
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
