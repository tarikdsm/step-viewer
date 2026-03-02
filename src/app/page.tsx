"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Viewer3D } from "@/components/Viewer3D";
import { ParsedPart } from "@/lib/stepParser";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [explodedValue, setExplodedValue] = useState<number>(0);
  const [parts, setParts] = useState<ParsedPart[]>([]);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);

  const handleFileUpload = (uploadedFile: File) => {
    setFile(uploadedFile);
    // Reset state on new file upload
    setParts([]);
    setSelectedParts([]);
    setExplodedValue(0);
  };

  const handleSelectPart = (id: string) => {
    setSelectedParts(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const handleGroupSelected = () => {
    if (selectedParts.length < 2) return;
    const groupId = `group-${Date.now()}`;
    setParts(prev => prev.map(p => {
      if (selectedParts.includes(p.id)) {
        return { ...p, groupId };
      }
      return p;
    }));
    setSelectedParts([]);
  };

  return (
    <main className="flex w-screen h-screen overflow-hidden bg-slate-900 font-sans">
      <Sidebar
        onFileUpload={handleFileUpload}
        explodedValue={explodedValue}
        onExplodedChange={setExplodedValue}
        parts={parts}
        selectedParts={selectedParts}
        onSelectPart={handleSelectPart}
        onGroupSelected={handleGroupSelected}
      />
      <Viewer3D
        file={file}
        explodedValue={explodedValue}
        parts={parts}
        selectedParts={selectedParts}
        onPartsParsed={setParts}
      />
    </main>
  );
}
