// thinManager_virus.js
import { ThinManager } from "./base_thinManager.js";

export class ThinManager_Virus extends ThinManager {

    _create_mesh(){
        const phi = (1 + Math.sqrt(5)) / 2;
        const a = 1.0, b = 1.0 / phi;
        const positions = [
            -a,  b,  0,    a,  b,  0,   -a, -b,  0,    a, -b,  0,
            0, -a,  b,    0,  a,  b,    0, -a, -b,    0,  a, -b,
            b,  0, -a,    b,  0,  a,   -b,  0, -a,   -b,  0,  a
        ];
        const indices = [
            0, 5,11,  0,11, 2,  0, 2,10,  0,10, 7,  0, 7, 5,
            1, 9, 5,  1, 5, 7,  1, 7, 8,  1, 8, 3,  1, 3, 9,
            4, 9, 3,  4, 3, 6,  4, 6, 2,  4, 2,11,  4,11, 9,
            5, 9,11,  7,10, 8,  6, 8,10,  8, 6, 3, 10, 2, 6
        ];

        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);

        const vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices   = indices;
        vertexData.normals   = normals;

        this.mesh = new BABYLON.Mesh("icosahedron", this.scene);
        vertexData.applyToMesh(this.mesh);
        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        // const mat = new BABYLON.PBRMaterial("virusmat", this.scene);
        // mat.metallic = 0.0;
        // mat.roughness = 1.0;
        // mat.albedoColor  = DRIFTING_ALBEDO;
        // mat.emissiveColor = DRIFTING_EMISSIVE;
        const mat = new BABYLON.CustomMaterial("virusMat", this.scene);
        mat.wireframe = true;
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        mat.Fragment_Before_FragColor(`color = vColor;`);
        this.mesh.material = mat;
    }

}