// prop_bubbles.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Drawable } from "./base_drawable.js";

const MAX_BUBBLES = 500;
const ZERO_SCALE = new BABYLON.Vector3(0, 0, 0);
const DEFAULT_SCALE = new BABYLON.Vector3(1, 1, 1);
const UPPER_LIMIT = 9.0;
const UP_SPEED = 0.01;

export class Prop_Bubbles extends Drawable {
    constructor(scene, cls) {
        super(scene, cls);
        this.bubble = null;
        this.matrixBuffer = new Float32Array(MAX_BUBBLES * 16);
        this.flags = new Array(MAX_BUBBLES).fill(false);

        this.tmp_position = new BABYLON.Vector3(0,0,0);
        this.QuatIdentity = BABYLON.Quaternion.Identity();
        this.tmp_matrix = new BABYLON.Matrix();
        this.create();
    }

    create() {
        this.mesh = BABYLON.MeshBuilder.CreateSphere("bubble", { diameter: 0.1 }, this.scene);
        this.mesh.alwaysSelectAsActiveMesh = true;
        const mat = new BABYLON.PBRMaterial("bubbleMat", this.scene);
        mat.albedoColor = new BABYLON.Color3(0.5, 0.8, 1.0);
        mat.emissiveColor = new BABYLON.Color3(0.5, 0.8, 1.0); // 自発光
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        mat.alpha = 1.0;
        mat.metallic = 0.0;
        mat.roughness = 1.0;
        mat.disableLighting = true;
        this.mesh.material = mat;
        this.mesh.thinInstanceEnablePicking = false;

        // 全スロットをスケール0の行列で初期化
        for (let i = 0; i < MAX_BUBBLES; i++) {
            this._writeMatrix(i, ZERO_SCALE, BABYLON.Vector3.Zero());
        }

        // Float32Arrayをそのまま渡す。第四引数（isStatic）は false に
        this.mesh.thinInstanceSetBuffer("matrix", this.matrixBuffer, 16, false);
    }

    _writeMatrix(index, scale, position) {
        BABYLON.Matrix.ComposeToRef(
            scale,
            this.QuatIdentity,
            position,
            this.tmp_matrix
        );
        this.tmp_matrix.copyToArray(this.matrixBuffer, index * 16);
    }

    add_bubble(pos) {
        let index = this.flags.findIndex(f => f === false);
        if (index === -1) {
            console.warn("No free bubble slot");
            return;
        }
        this._writeMatrix(index, DEFAULT_SCALE, pos);
        this.flags[index] = true;
        this.mesh.thinInstanceBufferUpdated("matrix"); // バッファ更新をGPUに通知
    }

    update(time, delta) {
        for (let i = 0; i < MAX_BUBBLES; i++) {
            if (!this.flags[i]) continue;

            const offset = i * 16;
            this.tmp_position.x = this.matrixBuffer[offset + 12];
            this.tmp_position.y = this.matrixBuffer[offset + 13] + UP_SPEED; //上昇
            this.tmp_position.z = this.matrixBuffer[offset + 14];

            if (this.tmp_position.y < UPPER_LIMIT) {
                this.tmp_position.x += Math.sin(time * 0.005 + i) * 0.004;
                this._writeMatrix(i, DEFAULT_SCALE, this.tmp_position);
            } else {
                this.flags[i] = false;
                this._writeMatrix(i, ZERO_SCALE, this.tmp_position);
            }
        }
        this.mesh.thinInstanceBufferUpdated("matrix");
    }
    dispose(){
        if (this.mesh){
            this.mesh.dispose();
            this.mesh = null;
        }
    }
}