"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stage, Environment, DragControls } from "@react-three/drei";
import * as THREE from 'three';
import { parseStepFile, ParsedPart } from "@/lib/stepParser";

/**
 * Props for the main Viewer3D scene orchestrator.
 */
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

/**
 * Represents a single distinct 3D geometry in the Canvas.
 * It handles its own visual state (color, wireframe, dragging) and dynamically
 * calculates its position offset if the Exploded View slider is active.
 */
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

    // Vector representing how far this specific part has moved from its origin
    let offset = new THREE.Vector3(0, 0, 0);

    // If the slider is active, calculate the geometric displacement
    if (explodedValue > 0) {
        // Calculate a directional vector from the center of the entire model pointing towards this part's center
        const direction = new THREE.Vector3().subVectors(part.center, modelCenter);
        const len = direction.length();
        if (len > 0.001) {
            direction.normalize();
            // We multiply by 3 to create a satisfying visual separation that scales naturally with the model's dimensions
            offset = direction.clone().multiplyScalar(len * (explodedValue / 100) * 3);
        }
    }

    // Determine the final rendering color, prioritizing user overrides over the STEP file's native color
    const displayColor = part.customColor ? new THREE.Color(part.customColor) : part.color;

    // Ensure finalOpacity is strictly clamped between 0.0 (invisible) and 1.0 (solid)
    const finalOpacity = Math.max(0, Math.min(1, (part.opacity ?? 1) * globalOpacity));

    // We abstract the mesh into a variable so we can conditionally wrap it in DragControls
    const meshContent = (
        <mesh position={offset} visible={part.visible !== false} onClick={measurementMode ? onPointerDown : undefined}>
            <primitive object={part.geometry} attach="geometry" />
            <meshStandardMaterial
                color={isSelected ? '#3b82f6' : displayColor}
                roughness={0.4}
                metalness={0.6}
                emissive={isSelected ? new THREE.Color('#1e40af') : new THREE.Color(0x000000)}
                emissiveIntensity={isSelected ? 0.3 : 0}
                // We force transparency to 'true' universally to prevent costly WebGL shader recompilations when dragging sliders
                transparent={true}
                opacity={finalOpacity}
                // Only write to the depth buffer if fully opaque to prevent weird culling artifacts when looking through transparent objects
                depthWrite={finalOpacity >= 1}
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

/**
 * A headless (non-rendering) component inserted into the R3F Canvas.
 * It intercepts mouse pointer events globally to draw a 2D HTML selection box
 * and performs the complex math of projecting 3D object coordinates into 2D screen space
 * to determine which parts fall inside the dragged rectangle.
 */
function BoxSelectionManager({ boxSelectMode, parts, setBoxRect, onSelectMultipleParts, explodedValue, modelCenter }: any) {
    // Access the raw Three.js camera and WebGL context
    const { camera, gl } = useThree();

    useEffect(() => {
        // If the mode is off, clear any lingering UI boxes and abort setup
        if (!boxSelectMode) {
            setBoxRect(null);
            return;
        }

        const dom = gl.domElement;
        let startPos: { x: number, y: number } | null = null;
        let isDragging = false;

        // 1. Begin building the selection box
        const onPointerDown = (e: PointerEvent) => {
            const rect = dom.getBoundingClientRect();
            // Store the initial 2D click coordinate relative to the Canvas
            startPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            isDragging = true;
        };

        // 2. Expand the selection box while dragging
        const onPointerMove = (e: PointerEvent) => {
            if (!isDragging || !startPos) return;
            const rect = dom.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;

            // Calculate Box origin Point (Top-Left) and dimensions (Width, Height)
            // Math.min/max are used to allow dragging in any direction flawlessly
            setBoxRect({
                x: Math.min(startPos.x, curX),
                y: Math.min(startPos.y, curY),
                w: Math.abs(curX - startPos.x),
                h: Math.abs(curY - startPos.y)
            });
        };

        // 3. Finalize the selection upon releasing the mouse
        const onPointerUp = (e: PointerEvent) => {
            if (!isDragging || !startPos) return;
            isDragging = false;

            const rect = dom.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;

            // Define the 4 boundaries of our 2D selection rectangle
            const minX = Math.min(startPos.x, curX);
            const maxX = Math.max(startPos.x, curX);
            const minY = Math.min(startPos.y, curY);
            const maxY = Math.max(startPos.y, curY);

            const newSelections: string[] = [];

            // Iterate over all active parts in the 3D scene to check for collisions
            parts.forEach((p: ParsedPart) => {
                if (p.visible === false) return;

                // --- Step A: Calculate the true 3D position ---
                // We must account for any artificial offset applied by the Exploded View slider
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

                // --- Step B: 3D to 2D Frustum Projection ---
                // Project the 3D coordinate against the active camera matrix to get Normalized Device Coordinates (NDC) [-1 to 1]
                const projected = currentPos.project(camera);

                // Convert NDC to standard screen pixels (Top-Left Origin)
                const screenX = (projected.x * 0.5 + 0.5) * rect.width;
                const screenY = (-(projected.y) * 0.5 + 0.5) * rect.height;

                // --- Step C: Collision Detection ---
                // Check if the pixel falls inside our HTML box AND isn't behind the camera (projected.z < 1)
                if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY && projected.z < 1) {
                    newSelections.push(p.id);
                }
            });

            // Push the array of IDs up to the global state through the Page callback
            if (newSelections.length > 0) {
                onSelectMultipleParts(newSelections);
            }

            // Cleanup UI
            setBoxRect(null);
            startPos = null;
        };

        // Attach listeners directly to the DOM to intercept them cleanly without React SyntheticEvents noise
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

/**
 * The primary 3D Viewer component.
 * It manages the lifecycle of the WebGL canvas, handles asynchronous loading of STEP files
 * into the scene, processes user measurements, and orchestrates the layout of parts and controls.
 */
export function Viewer3D({ file, explodedValue, globalOpacity, measurementMode, wireframeMode, dragMode, boxSelectMode, parts, selectedParts, onPartsParsed, onSelectMultipleParts }: Viewer3DProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
    const [boxRect, setBoxRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    // 1. Asynchronously load the file and parse it via WASM whenever the 'file' prop changes
    useEffect(() => {
        if (!file) return;

        let isMounted = true;
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Call the pure function imported from our stepParser logic
                const parsedParts = await parseStepFile(file);
                if (isMounted) {
                    // Bubble the loaded parts up to the global React state so the Sidebar can display them
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

        // Cleanup function to prevent setting state on an unmounted component if the user switches files rapidly
        return () => { isMounted = false; };
    }, [file, onPartsParsed]);

    // Clear measurements if the user toggles the mode off
    useEffect(() => {
        if (!measurementMode) setMeasurePoints([]);
    }, [measurementMode]);

    // Handle clicks directly on the 3D meshes for generating points in the 3D space
    const handlePointerDown = (e: any) => {
        if (!measurementMode) return;
        // Stop the event from penetrating through to meshes behind the clicked one
        e.stopPropagation();

        // Ensure we clone the point vector from the intersection event
        const pt = e.point.clone();
        setMeasurePoints(prev => {
            // Keep exactly 2 points. If we click a third time, restart the measurement.
            if (prev.length >= 2) return [pt];
            return [...prev, pt];
        });
    };

    // Only calculate distance if a pair of points is established
    let measurementDistance = 0;
    let measurementMidpoint = new THREE.Vector3();
    if (measurePoints.length === 2) {
        measurementDistance = measurePoints[0].distanceTo(measurePoints[1]);
        // Mathematical midpoint to accurately position the floating HTML distance label
        measurementMidpoint = new THREE.Vector3().addVectors(measurePoints[0], measurePoints[1]).multiplyScalar(0.5);
    }

    // Calculate the mathematical center of the ENTIRE assembly
    // Memoized for performance to survive frequent standard re-renders
    const modelCenter = useMemo(() => {
        if (parts.length === 0) return new THREE.Vector3(0, 0, 0);
        const box = new THREE.Box3();
        // Expand the virtual bounding box to encompass the center-points of every child part
        parts.forEach(p => box.expandByPoint(p.center));
        const center = new THREE.Vector3();
        box.getCenter(center);
        return center;
    }, [parts]);

    // Calculate the localized center for individually user-created Groups 
    // This allows groups to explode collectively as a single block from the model center
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
            {/* The transparent blue overlay drawn directly upon HTML indicating the Marquee bounds */}
            {boxRect && (
                <div style={{
                    position: 'absolute', pointerEvents: 'none', zIndex: 100,
                    left: boxRect.x, top: boxRect.y, width: boxRect.w, height: boxRect.h,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.8)'
                }} />
            )}

            {/* Native loading overlay while WebAssembly processes the heavy file buffering */}
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

            {/* Main React-Three-Fiber context boundary */}
            {/* preserveDrawingBuffer=true is mandatory for the Screenshot API function to capture the WebGL state */}
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

                            {/* Measurement render block */}
                            {measurePoints.length > 0 && (
                                <group>
                                    {measurePoints.map((pt, idx) => (
                                        <mesh key={idx} position={pt}>
                                            <sphereGeometry args={[1, 16, 16]} />
                                            {/* We instruct Three.js to ignore depth limits to ensure these points are always visible across the model */}
                                            <meshBasicMaterial color="yellow" depthTest={false} />
                                        </mesh>
                                    ))}
                                    {/* Draw the visual connecting line and HTML Label only when the vector pair is complete */}
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

                {/* The default camera controller. We explicitly disable it during specific active manipulation modes to prevent disruptive scene spins */}
                <OrbitControls makeDefault enabled={!dragMode && !boxSelectMode && measurementMode === false} />
                <Environment preset="city" />

                {/* Non-rendering overlay logic handler */}
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
