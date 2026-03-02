import * as THREE from 'three';
import initOpenCascade from 'occt-import-js';

let occt: any = null;

export interface ParsedPart {
    id: string;
    groupId?: string;
    name: string;
    geometry: THREE.BufferGeometry;
    color: THREE.Color;
    center: THREE.Vector3;
}

export async function parseStepFile(file: File): Promise<ParsedPart[]> {
    if (!occt) {
        occt = await initOpenCascade({
            locateFile: (path: string) => {
                if (path === 'occt-import-js.wasm') {
                    return '/occt-import-js.wasm';
                }
                return path;
            }
        });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Parse the step file data using occt-import-js
    const result = occt.ReadStepFile(fileData, null);

    const parts: ParsedPart[] = [];

    if (result && result.meshes) {
        for (let i = 0; i < result.meshes.length; i++) {
            const meshData = result.meshes[i];
            const geometry = new THREE.BufferGeometry();

            if (meshData.attributes.position) {
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3));
            }
            if (meshData.attributes.normal) {
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3));
            }
            if (meshData.index) {
                // use Uint32 for indices to be safe for large files
                geometry.setIndex(new THREE.Uint32BufferAttribute(meshData.index.array, 1));
            }

            geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            geometry.boundingBox?.getCenter(center);

            let color = new THREE.Color(0xcccccc); // default grey
            if (meshData.color) {
                color = new THREE.Color(meshData.color[0], meshData.color[1], meshData.color[2]);
            }

            parts.push({
                id: `part-${i}`,
                name: meshData.name || `Part ${i + 1}`,
                geometry,
                color,
                center,
            });
        }
    }

    return parts;
}
