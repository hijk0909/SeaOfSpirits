// thinManager_plankton.js
import { ThinManager } from "./base_thinManager.js";

const DEFAULT_COLOR = new BABYLON.Color3(0.0, 1.0, 0.0);

export class ThinManager_Plankton extends ThinManager {

    _create_mesh(){
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "planktonBody", { diameter: 0.5, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        const mat = new BABYLON.CustomMaterial("planktonMat", this.scene);
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        mat.specularColor = new BABYLON.Color3(0, 0, 0);      // ギラつきを消す
        mat.ambientColor  = new BABYLON.Color3(0.4, 0.4, 0.4); // 光の影響を薄める
        mat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05); // 下駄履き

        this.mesh.material = mat;
    }

}