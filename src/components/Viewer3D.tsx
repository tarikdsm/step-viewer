"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, Environment } from "@react-three/drei";
import * as THREE from 'three';
import { parseStepFile, ParsedPart } from "@/lib/stepParser";

interface Viewer3DProps {
    file: File | null;
    explodedValue: number;
    parts: ParsedPart[];
    selectedParts: string[];
    onPartsParsed: (parts: ParsedPart[]) => void;
}

function PartMesh({ part, explodedValue, isSelected, modelCenter, groupCenter }: { part: ParsedPart, explodedValue: number, isSelected: boolean, modelCenter: THREE.Vector3, groupCenter?: THREE.Vector3 }) {
    const referenceCenter = groupCenter || part.center;
    const direction = new THREE.Vector3().subVectors(referenceCenter, modelCenter).normalize();
    const offset = direction.clone().multiplyScalar((explodedValue / 100) * 50); // max 50 units explode

    return (
        <mesh position={offset}>
            <primitive object={part.geometry} attach="geometry" />
            <meshStandardMaterial
                color={isSelected ? '#3b82f6' : part.color}
                roughness={0.4}
                metalness={0.6}
                emissive={isSelected ? new THREE.Color('#1e40af') : new THREE.Color(0x000000)}
                emissiveIntensity={isSelected ? 0.3 : 0}
            />
        </mesh>
    );
}

export function Viewer3D({ file, explodedValue, parts, selectedParts, onPartsParsed }: Viewer3DProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!file) return;

        let isMounted = true;
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const parsedParts = await parseStepFile(file);
                if (isMounted) {
                    onPartsParsed(parsedParts);
                }
            } catch (err) {
                console.error("Failed to parse file:", err);
                if (isMounted) setError("Failed to parse STEP file. Please ensure it is a valid format.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadData();

        return () => { isMounted = false; };
    }, [file, onPartsParsed]);

    const modelCenter = useMemo(() => {
        if (parts.length === 0) return new THREE.Vector3(0, 0, 0);
        const box = new THREE.Box3();
        parts.forEach(p => box.expandByPoint(p.center));
        const center = new THREE.Vector3();
        box.getCenter(center);
        return center;
    }, [parts]);

    const groupCenters = useMemo(() => {
        const boxes: Record<string, THREE.Box3> = {};
        parts.forEach(p => {
            if (p.groupId) {
                if (!boxes[p.groupId]) boxes[p.groupId] = new THREE.Box3();
                boxes[p.groupId].expandByPoint(p.center);
            }
        });

        const centers: Record<string, THREE.Vector3> = {};
        Object.keys(boxes).forEach(gid => {
            const center = new THREE.Vector3();
            boxes[gid].getCenter(center);
            centers[gid] = center;
        });
        return centers;
    }, [parts]);

    return (
        <div className="flex-1 w-full h-full relative bg-[#1e293b]">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                        <p className="text-blue-400 font-medium animate-pulse">Processing 3D Geometry...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-red-400 bg-slate-900/90 px-6 py-4 rounded-xl backdrop-blur-md border border-red-900">
                        {error}
                    </div>
                </div>
            )}

            {!file && !isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-slate-400 bg-slate-900/60 px-6 py-4 rounded-xl backdrop-blur-md border border-slate-700/50 shadow-2xl">
                        Please upload a .STEP file to view
                    </div>
                </div>
            )}

            <Canvas shadows camera={{ position: [0, 0, 100], fov: 50 }}>
                <color attach="background" args={['#1e293b']} />

                {parts.length > 0 && !isLoading && (
                    <Stage preset="rembrandt" intensity={0.8} environment="city" adjustCamera={1.5}>
                        <group>
                            {parts.map(part => (
                                <PartMesh
                                    key={part.id}
                                    part={part}
                                    explodedValue={explodedValue}
                                    isSelected={selectedParts.includes(part.id)}
                                    modelCenter={modelCenter}
                                    groupCenter={part.groupId ? groupCenters[part.groupId] : undefined}
                                />
                            ))}
                        </group>
                    </Stage>
                )}

                <OrbitControls makeDefault />
                <Environment preset="city" />
            </Canvas>
        </div>
    );
}
