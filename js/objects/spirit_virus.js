// spirit_virus.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";

const HP_DECREASE = 0.002;
const HP_ABSORB = 0.04;

// ウイルス
export class Spirit_Virus extends Spirit {

    constructor(scene, class_name, type_name){
        super(scene, class_name, type_name);

        this.disp_scale = 0.08;
        this.isCollidable = false;

        this.hp_max = 10;
        this.hp = this.hp_max;
        this.hp_decrease = HP_DECREASE;

        this.infecting = false;
        this.infection_classes = ["Spirit_Fish", "Spirit_Jelly", "Spirit_Shark", "Spirit_Whale"];
        this.infectionRadius = 0.2; 
        this.infectionObject = null;
        this.infectionMattrix = null;

        this._tmpScale    = new BABYLON.Vector3();
        this._tmpRot      = new BABYLON.Quaternion();
        this._tmpPos      = new BABYLON.Vector3();
    }

    create(params){

        // ◆ボディの作成
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

        const mat = new BABYLON.PBRMaterial("mat", this.scene);
        // mat.metallic = 0.0;
        // mat.roughness = 1.0;
        mat.diffuseColor  = new BABYLON.Color3(1.0, 0.0, 0.6);
        mat.emissiveColor = new BABYLON.Color3(0.5, 0.0, 0.3);
        mat.wireframe = true;
        this.mesh.material = mat;
        this.mesh.scaling = new BABYLON.Vector3(this.disp_scale, this.disp_scale, this.disp_scale);

        super.create(params);
    }

    activate(pos, params){
        this.mesh.material.emissiveColor = new BABYLON.Color3(1.0, 0.0, 0.8);
        super.activate(pos, params);
    }

    deactivate(){
        super.deactivate();
    }

    update(time, delta){
        if (this.infecting){
            // ◆感染状態
            if (!this.infectionObject || !this.infectionObject.alive || this.infectionObject.dying){
                this.infecting = false;
                this.hp_decrease = HP_DECREASE;
                // [TEST]
                GameState.bubbles.add_bubble(this.root.position);
                // console.log("[VIRUS] Parent DIE");
            } else {
                const newWorldMat = this.infectionMatrix.multiply(this.infectionObject.root.getWorldMatrix());
                newWorldMat.decompose(this._tmpScale, this._tmpRot, this._tmpPos);
                this.root.position  = this._tmpPos;
                this.root.rotationQuaternion = this._tmpRot;
                this.infectionObject.hp = Math.max(0, this.infectionObject.hp - HP_ABSORB);
                this.hp = Math.min(this.hp_max, this.hp + HP_ABSORB);
                // console.log("[VIRUS] Infecting");         
            }
        } else {
            // ◆浮遊状態
            if (this.root.position.length() > 3.5){
                this.control_velocity = this.root.position.scale(-0.001);
            }
            this.control_velocity.scaleInPlace(0.98);
            for (let spirit of GameState.spirits){
                if (this.infection_classes.includes(spirit.class_name)){
                    if (spirit.dying) continue;
                    const dx = this.root.position.x - spirit.root.position.x;
                    const dy = this.root.position.y - spirit.root.position.y;
                    const dz = this.root.position.z - spirit.root.position.z;
                    const distSq = dx*dx + dy*dy + dz*dz;
                    const radius_sum = this.infectionRadius + spirit.collisionRadius;
                    if ( distSq < radius_sum * radius_sum ){
                        // console.log("[VIRUS] Infection");
                        this.infecting = true;
                        this.hp_decrease = 0.0;
                        this.infectionObject = spirit;
                        const worldMatA = this.root.getWorldMatrix();
                        const worldMatB = spirit.root.getWorldMatrix();
                        const invWorldMatB = BABYLON.Matrix.Invert(worldMatB);
                        this.infectionMatrix = worldMatA.multiply(invWorldMatB);
                        this.control_velocity.copyFrom(GLOBALS.ZERO_VECTOR);

                        // [TEST]
                        GameState.bubbles.add_bubble(this.root.position);
                        break;
                    }
                }
            }            
        }
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}