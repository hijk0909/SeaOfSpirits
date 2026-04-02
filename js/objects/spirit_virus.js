// spirit_virus.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";

const HP_DECREASE = 0.002;
const HP_ABSORB = 0.04;

const INFECTING_EMISSIVE = new BABYLON.Color3(5.0, 0, 0.2);
const INFECTING_ALBEDO = new BABYLON.Color3(1.0, 0, 0.5);
const DRIFTING_EMISSIVE = new BABYLON.Color3(0.3, 0, 0.2);
const DRIFTING_ALBEDO = new BABYLON.Color3(0.6, 0, 0.3);

// ウイルス
export class Spirit_Virus extends Spirit {

    constructor(scene, class_name, generation){
        super(scene, class_name, generation);

        // クラス遺伝子
        this.genome.hp_max = 10;
        this.genome.hp_decrease = HP_DECREASE;
        this.genome.disp_scale = 0.08;
        this.genome.is_collidable = false;
        this.genome.collision_radius = 0.15;

        // クラス固有の設定      
        this.infecting = false;
        this.infection_classes = ["Spirit_Fish", "Spirit_Jelly", "Spirit_Shark", "Spirit_Squid", "Spirit_Whale"];
        this.infectionRadius = 0.16;
        this.infectionObject = null;
        this.infectionMattrix = null;

        // テンポラリ変数
        this.tmpScale    = new BABYLON.Vector3();
        this.tmpRot      = new BABYLON.Quaternion();
        this.tmpPos      = new BABYLON.Vector3();
    }

    create(genome_modifier){
        super.create(genome_modifier);
    }

    _create_body(){
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

        const mat = new BABYLON.PBRMaterial("virusmat", this.scene);
        // mat.metallic = 0.0;
        // mat.roughness = 1.0;
        // mat.albedoColor  = DRIFTING_ALBEDO;
        // mat.emissiveColor = DRIFTING_EMISSIVE;
        mat.wireframe = true;
        this.mesh.material = mat;
    }

    activate(pos){
        this.infecting = false;
        this.mesh.albedoColor  = DRIFTING_ALBEDO;
        this.set_emissive_base(DRIFTING_EMISSIVE);
        super.activate(pos);
    }

    deactivate(){
        super.deactivate();
    }

    update(time, delta){
        if (this.infecting){
            // ◆感染状態
            if (!this.infectionObject || !this.infectionObject.alive || this.infectionObject.dying){
                this.infecting = false;
                this.hp_decrease = this.genome.hp_decrease;

                this.mesh.material.albedoColor = DRIFTING_ALBEDO;
                this.set_emissive_base(DRIFTING_EMISSIVE);
                // [TEST]
                GameState.bubbles.add_bubble(this.root.position);
                // console.log("[VIRUS] Parent DIE");
            } else {
                const newWorldMat = this.infectionMatrix.multiply(this.infectionObject.root.getWorldMatrix());
                newWorldMat.decompose(this.tmpScale, this.tmpRot, this.tmpPos);
                this.root.position  = this.tmpPos;
                this.root.rotationQuaternion = this.tmpRot;
                this.infectionObject.hp = Math.max(0, this.infectionObject.hp - HP_ABSORB);
                this.hp = Math.min(this.genome.hp_max, this.hp + HP_ABSORB);
                // console.log("[VIRUS] Infecting");         
            }
        } else {
            // ◆浮遊状態
            if (this.root.position.length() > 5.0){
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
                        this.mesh.material.albedoColor = INFECTING_ALBEDO;
                        this.set_emissive_base(INFECTING_EMISSIVE, 0);

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