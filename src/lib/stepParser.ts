/**
 * Core utility for parsing STEP (.stp) CAD files purely on the client-side.
 * It utilizes an OpenCascade WebAssembly (WASM) build via the 'occt-import-js' library
 * to convert the dense boundary-representation (B-rep) STEP formats into explicit 
 * triangular meshes suitable for WebGL rendering via Three.js.
 */
import * as THREE from 'three';
import initOpenCascade from 'occt-import-js';

// Cache the loaded WebAssembly module to prevent downloading/initializing 
// the heavy WASM binary multiple times during the application lifecycle.
import { OCCTInstance, OCCTResult } from 'occt-import-js';
let occt: OCCTInstance | null = null;

/**
 * Interface defining the structure of a successfully parsed 3D part.
 * Contains both the raw geometric data and the reactive UI states (visibility, colors)
 * required for the interactive 3D Viewer features.
 */
export interface ParsedPart {
    id: string; // Unique identifier for React mapping and selection
    groupId?: string; // Optional grouping identifier for moving/exploding parts together
    name: string; // The extracted name of the node from the STEP hierarchy
    geometry: THREE.BufferGeometry; // The triangulated 3D mesh data
    color: THREE.Color; // Original material color defined in the STEP file (or default)
    center: THREE.Vector3; // The mathematical center point of the part's bounding box
    visible: boolean; // Toggle for hiding/showing the part in the viewer
    opacity: number; // Individual opacity multiplier 
    customColor?: string; // Hex color override from the UI (e.g. #ff0000)
}

/**
 * Parses a given File object containing STEP data and returns an array of ParsedParts.
 * 
 * @param file The standard HTML File object (from drag-n-drop or file input)
 * @returns A promise that resolves to an array of ready-to-render ParsedPart objects.
 */
export async function parseStepFile(file: File): Promise<ParsedPart[]> {
    // 1. Initialize the OpenCascade WASM module if not already loaded.
    if (!occt) {
        occt = await initOpenCascade({
            // Explicitly route the WASM fetch to the public directory of Next.js
            locateFile: (path: string) => {
                if (path === 'occt-import-js.wasm') {
                    return '/occt-import-js.wasm'; // Served from /public/occt-import-js.wasm
                }
                return path;
            }
        });
    }

    // 2. Read the File into memory as a raw byte array so the C++ WASM can process it.
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // 3. Execute the heavy lifting: Parse the STEP file binary into a structured JSON/Mesh object
    // Passing 'null' as the second parameter here uses default tessellation tolerances.
    const result: OCCTResult = occt.ReadStepFile(fileData, null);

    if (!Array.isArray(result.meshes)) {
        console.warn('STEP parser returned no meshes or unexpected structure. The file may be empty or unsupported.');
        return [];
    }

    const parts: ParsedPart[] = [];

    // 4. Transform the extracted flat arrays into Three.js BufferGeometries
    for (let i = 0; i < result.meshes.length; i++) {
        const meshData = result.meshes[i];
            const geometry = new THREE.BufferGeometry();

            // Populate the Vertices (Positions)
            if (meshData.attributes.position) {
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3));
            }

            // Populate the Normals (for lighting/shading calculations)
            if (meshData.attributes.normal) {
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3));
            }

            // Populate the Face Indices (which vertices make up which triangles)
            if (meshData.index) {
                // We use Uint32BufferAttribute because complex CAD parts easily exceed the 65k vertex limit of Uint16.
                geometry.setIndex(new THREE.Uint32BufferAttribute(meshData.index.array, 1));
            }

            // 5. Pre-compute the physical boundaries and center point. 
            // This is crucial for precise OrbitControls framing, Exploded Views, and Box selections.
            geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            geometry.boundingBox?.getCenter(center);

            // 6. Extract the native part color if defined, otherwise fallback to a generic neutral grey.
            let color = new THREE.Color(0xcccccc);
            if (meshData.color) {
                // The extracted color arrays are strictly normalized RGB [0.0 to 1.0]
                color = new THREE.Color(meshData.color[0], meshData.color[1], meshData.color[2]);
            }

            // Assemble the final object containing both geometry and semantic state
            parts.push({
                id: `part-${i}`,
                name: meshData.name || `Part ${i + 1}`,
                geometry,
                color,
                center,
                visible: true,
                opacity: 1 // Default to fully opaque
            });
    }

    return parts;
}
