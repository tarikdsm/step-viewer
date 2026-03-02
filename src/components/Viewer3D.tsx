"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stage, Environment, DragControls } from "@react-three/drei";
import * as THREE from 'three';
import { parseStepFile, ParsedPart } from "@/lib/stepParser";

interface Viewer3DProps {
    file: File | null;
    explodedValue: number;
    globalOpacity: number;
    measurementMode: boolean;
    wireframeMode: boolean;
    dragMode: boolean;
    boxSelectMode: boolean;
    parts: ParsedPart[];
    selectedParts: string[];
    onPartsParsed: (parts: ParsedPart[]) => void;
    onSelectMultipleParts: (ids: string[]) => void;
}

function PartMesh({
    part,
    explodedValue,
    isGroupSelected,
    modelCenter,
    groupCenter,
    globalOpacity,
    measurementMode,
    wireframeMode,
    dragMode,
    selectedParts,
    onPointerDown
}: {
    part: ParsedPart,
    explodedValue: number,
    isGroupSelected: boolean,
    modelCenter: THREE.Vector3,
    groupCenter?: THREE.Vector3,
    globalOpacity: number,
    measurementMode: boolean,
    wireframeMode: boolean,
    dragMode: boolean,
    selectedParts: string[],
    onPointerDown: (e: any) => void
}) {
    const isSelected = selectedParts && selectedParts.includes(part.id);

    let offset = new THREE.Vector3(0, 0, 0);

    if (explodedValue > 0) {
        const direction = new THREE.Vector3().subVectors(part.center, modelCenter);
        const len = direction.length();
        if (len > 0.001) {
            direction.normalize();
            // Multiplier of 3 provides a good visual separation proportional to model size
            offset = direction.clone().multiplyScalar(len * (explodedValue / 100) * 3);
        }
    }

    const displayColor = part.customColor ? new THREE.Color(part.customColor) : part.color;
    // Ensure finalOpacity is strictly between 0 and 1
    const finalOpacity = Math.max(0, Math.min(1, (part.opacity ?? 1) * globalOpacity));

    const meshContent = (
        <mesh position={offset} visible={part.visible !== false} onClick={measurementMode ? onPointerDown : undefined}>
            <primitive object={part.geometry} attach="geometry" />
            <meshStandardMaterial
                color={isSelected ? '#3b82f6' : displayColor}
                roughness={0.4}
                metalness={0.6}
                emissive={isSelected ? new THREE.Color('#1e40af') : new THREE.Color(0x000000)}
                emissiveIntensity={isSelected ? 0.3 : 0}
                transparent={true} // Force transparent to avoid shader recompilation quantization bugs
                opacity={finalOpacity}
                depthWrite={finalOpacity >= 1} // Only write depth if fully opaque
                wireframe={wireframeMode}
            />
        </mesh>
    );

    return dragMode ? (
        <DragControls>
            {meshContent}
        </DragControls>
    ) : (
        meshContent
    );
}

function BoxSelectionManager({ boxSelectMode, parts, setBoxRect, onSelectMultipleParts, explodedValue, modelCenter }: any) {
    const { camera, gl } = useThree();

    useEffect(() => {
        if (!boxSelectMode) {
            setBoxRect(null);
            return;
        }

        const dom = gl.domElement;
        let startPos: { x: number, y: number } | null = null;
        let isDragging = false;

        const onPointerDown = (e: PointerEvent) => {
            const rect = dom.getBoundingClientRect();
            startPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            isDragging = true;
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!isDragging || !startPos) return;
            const rect = dom.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;

            setBoxRect({
                x: Math.min(startPos.x, curX),
                y: Math.min(startPos.y, curY),
                w: Math.abs(curX - startPos.x),
                h: Math.abs(curY - startPos.y)
            });
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!isDragging || !startPos) return;
            isDragging = false;

            const rect = dom.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;

            const minX = Math.min(startPos.x, curX);
            const maxX = Math.max(startPos.x, curX);
            const minY = Math.min(startPos.y, curY);
            const maxY = Math.max(startPos.y, curY);

            const newSelections: string[] = [];
            parts.forEach((p: ParsedPart) => {
                if (p.visible === false) return;

                // Calculate the true position combining explodedValue offset
                let offset = new THREE.Vector3(0, 0, 0);
                if (explodedValue > 0) {
                    const dir = new THREE.Vector3().subVectors(p.center, modelCenter);
                    const len = dir.length();
                    if (len > 0.001) {
                        dir.normalize();
                        offset = dir.clone().multiplyScalar(len * (explodedValue / 100) * 3);
                    }
                }
                const currentPos = p.center.clone().add(offset);

                const projected = currentPos.project(camera);
                const screenX = (projected.x * 0.5 + 0.5) * rect.width;
                const screenY = (-(projected.y) * 0.5 + 0.5) * rect.height;

                if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY && projected.z < 1) {
                    newSelections.push(p.id);
                }
            });

            if (newSelections.length > 0) {
                onSelectMultipleParts(newSelections);
            }

            setBoxRect(null);
            startPos = null;
        };

        dom.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        return () => {
            dom.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [boxSelectMode, parts, camera, gl.domElement, onSelectMultipleParts, explodedValue, modelCenter, setBoxRect]);

    return null;
}

import { Html, Line } from "@react-three/drei";

export function Viewer3D({ file, explodedValue, globalOpacity, measurementMode, wireframeMode, dragMode, boxSelectMode, parts, selectedParts, onPartsParsed, onSelectMultipleParts }: Viewer3DProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
    const [boxRect, setBoxRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

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

    useEffect(() => {
        if (!measurementMode) setMeasurePoints([]);
    }, [measurementMode]);

    const handlePointerDown = (e: any) => {
        if (!measurementMode) return;
        e.stopPropagation();

        const pt = e.point.clone();
        setMeasurePoints(prev => {
            if (prev.length >= 2) return [pt];
            return [...prev, pt];
        });
    };

    let measurementDistance = 0;
    let measurementMidpoint = new THREE.Vector3();
    if (measurePoints.length === 2) {
        measurementDistance = measurePoints[0].distanceTo(measurePoints[1]);
        measurementMidpoint = new THREE.Vector3().addVectors(measurePoints[0], measurePoints[1]).multiplyScalar(0.5);
    }

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

    // Check if a part belongs to a group that has at least one selected item
    // or if the part itself is selected.
    const isPartInSelectedGroup = (part: ParsedPart) => {
        if (selectedParts.includes(part.id)) return true;
        if (!part.groupId) return false;
        return parts.some(p => p.groupId === part.groupId && selectedParts.includes(p.id));
    };

    const hasAnySelection = selectedParts.length > 0;

    return (
        <div className="flex-1 w-full h-full relative bg-[#1e293b]">
            {boxRect && (
                <div style={{
                    position: 'absolute', pointerEvents: 'none', zIndex: 100,
                    left: boxRect.x, top: boxRect.y, width: boxRect.w, height: boxRect.h,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.8)'
                }} />
            )}
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

            <Canvas gl={{ preserveDrawingBuffer: true }} shadows camera={{ position: [0, 0, 100], fov: 50 }}>
                <color attach="background" args={['#1e293b']} />

                {parts.length > 0 && !isLoading && (
                    <Stage preset="rembrandt" intensity={0.8} environment="city" adjustCamera={1.5}>
                        <group>
                            {parts.map(part => (
                                <PartMesh
                                    key={part.id}
                                    part={part}
                                    explodedValue={explodedValue}
                                    // If there are selections globally, we determine its grouped behavior. If nothing is selected globally, it acts ungrouped (explodes individually)
                                    isGroupSelected={hasAnySelection ? isPartInSelectedGroup(part) : false}
                                    modelCenter={modelCenter}
                                    groupCenter={part.groupId ? groupCenters[part.groupId] : undefined}
                                    globalOpacity={globalOpacity}
                                    measurementMode={measurementMode}
                                    wireframeMode={wireframeMode}
                                    dragMode={dragMode}
                                    selectedParts={selectedParts}
                                    onPointerDown={handlePointerDown}
                                />
                            ))}

                            {measurePoints.length > 0 && (
                                <group>
                                    {measurePoints.map((pt, idx) => (
                                        <mesh key={idx} position={pt}>
                                            <sphereGeometry args={[1, 16, 16]} />
                                            <meshBasicMaterial color="yellow" depthTest={false} />
                                        </mesh>
                                    ))}
                                    {measurePoints.length === 2 && (
                                        <>
                                            <Line
                                                points={[measurePoints[0], measurePoints[1]]}
                                                color="yellow"
                                                lineWidth={3}
                                                depthTest={false}
                                            />
                                            <Html position={measurementMidpoint} center>
                                                <div className="bg-slate-900 border border-yellow-500 text-yellow-400 font-mono px-2 py-1 rounded shadow-lg whitespace-nowrap text-sm ml-4 -mt-4 z-50 pointer-events-none">
                                                    {measurementDistance.toFixed(2)} mm
                                                </div>
                                            </Html>
                                        </>
                                    )}
                                </group>
                            )}
                        </group>
                    </Stage>
                )}

                <OrbitControls makeDefault enabled={!dragMode && !boxSelectMode && measurementMode === false} />
                <Environment preset="city" />
                <BoxSelectionManager
                    boxSelectMode={boxSelectMode}
                    parts={parts}
                    setBoxRect={setBoxRect}
                    onSelectMultipleParts={onSelectMultipleParts}
                    explodedValue={explodedValue}
                    modelCenter={modelCenter}
                />
            </Canvas>
        </div>
    );
}
