"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Viewer3D } from "@/components/Viewer3D";
import { ParsedPart } from "@/lib/stepParser";

/**
 * The root component of the application.
 * It serves as the single source of truth for the global React state, 
 * bridging the communication between the UI Sidebar and the WebGL Viewer3D.
 */
export default function Home() {
  // --- Core Application State ---
  const [file, setFile] = useState<File | null>(null);
  const [explodedValue, setExplodedValue] = useState<number>(0);
  const [globalOpacity, setGlobalOpacity] = useState<number>(1);
  const [parts, setParts] = useState<ParsedPart[]>([]);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  // --- Interactive Mode Flags ---
  const [measurementMode, setMeasurementMode] = useState<boolean>(false);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<boolean>(false);
  const [boxSelectMode, setBoxSelectMode] = useState<boolean>(false);

  /**
   * Resets all visual states and active modes when a new file is uploaded
   * and prepares the pipeline for the new geometry payload.
   */
  const handleFileUpload = (uploadedFile: File) => {
    setFile(uploadedFile);
    setParts([]);
    setSelectedParts([]);
    setExplodedValue(0);
    setGlobalOpacity(1);
    setMeasurementMode(false);
    setWireframeMode(false);
    setDragMode(false);
    setBoxSelectMode(false);
  };

  /**
   * Fetches a previously saved file from the Next.js API endpoint,
   * converts the HTTP response stream back into a native browser File object,
   * and feeds it into the normal upload pipeline.
   */
  const handleLoadSavedFile = async (filename: string) => {
    try {
      const res = await fetch(`/api/files/download?name=${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error("Failed to download");

      const blob = await res.blob();
      // Mocking a File object from the Blob to pass to our existing stepParser logic
      const downloadedFile = new File([blob], filename, { type: 'application/octet-stream' });

      handleFileUpload(downloadedFile);
    } catch (err) {
      console.error("Error loading saved file:", err);
      alert("Failed to load saved file");
    }
  };

  /**
   * Toggles the selection state of a specific part. 
   * Provides standard Ctrl/Cmd clicking logic (selectMultiple) allowing
   * users to pick multiple isolated parts sequentially.
   */
  const handleSelectPart = (id: string, selectMultiple: boolean = false) => {
    setSelectedParts(prev => {
      if (selectMultiple) {
        return prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      }
      return prev.includes(id) && prev.length === 1 ? [] : [id];
    });
  };

  /**
   * Merges a bulk array of part IDs into the current selection pool.
   * Utilized primarily by the BoxSelectionManager which highlights dozens of parts instantly.
   */
  const handleSelectMultipleParts = (ids: string[]) => {
    setSelectedParts(prev => Array.from(new Set([...prev, ...ids])));
  };

  /**
   * Toggles whether a specific part mesh is rendered in the WebGL scene.
   */
  const handleTogglePartVisibility = (id: string) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p));
  };

  /**
   * Overwrites the native STEP material color for a specific mesh.
   */
  const handleChangePartColor = (id: string, color: string) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, customColor: color } : p));
  };

  /**
   * Bundles all currently selected parts under a shared unique 'groupId'.
   * This signals the Viewer3D to explode them outward as a single contiguous object.
   */
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

  /**
   * Programmatically clicks a hidden anchor tag filled directly with the 
   * Base64 byte stream of the Canvas WebGL buffer.
   */
  const handleScreenshot = () => {
    const canvasObj = document.querySelector('canvas');
    if (canvasObj) {
      const a = document.createElement('a');
      a.download = 'step-screenshot.png';
      a.href = canvasObj.toDataURL('image/png');
      a.click();
    }
  };

  return (
    <main className="flex w-screen h-screen overflow-hidden bg-slate-900 font-sans">
      <Sidebar
        onFileUpload={handleFileUpload}
        explodedValue={explodedValue}
        onExplodedChange={setExplodedValue}
        globalOpacity={globalOpacity}
        onGlobalOpacityChange={setGlobalOpacity}
        measurementMode={measurementMode}
        onToggleMeasurementMode={() => setMeasurementMode(prev => !prev)}
        parts={parts}
        selectedParts={selectedParts}
        onSelectPart={handleSelectPart}
        onGroupSelected={handleGroupSelected}
        onLoadSavedFile={handleLoadSavedFile}
        onTogglePartVisibility={handleTogglePartVisibility}
        onChangePartColor={handleChangePartColor}
        wireframeMode={wireframeMode}
        onToggleWireframe={() => setWireframeMode(prev => !prev)}
        onScreenshot={handleScreenshot}
        dragMode={dragMode}
        onToggleDragMode={() => setDragMode(prev => !prev)}
        boxSelectMode={boxSelectMode}
        onToggleBoxSelectMode={() => setBoxSelectMode(prev => !prev)}
      />
      <Viewer3D
        file={file}
        explodedValue={explodedValue}
        globalOpacity={globalOpacity}
        measurementMode={measurementMode}
        wireframeMode={wireframeMode}
        dragMode={dragMode}
        boxSelectMode={boxSelectMode}
        parts={parts}
        selectedParts={selectedParts}
        onPartsParsed={setParts}
        onSelectMultipleParts={handleSelectMultipleParts}
      />
    </main>
  );
}
