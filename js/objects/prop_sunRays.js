// prop_sunRays.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Drawable } from "./base_drawable.js";

const MAX_RAYS = 20;
const ZERO_SCALE = new BABYLON.Vector3(0, 0, 0);
const DEFAULT_SCALE = new BABYLON.Vector3(1, 1, 1);
const RAY_LENGTH = 20.0;
const RAY_ALPHA = 0.4;

export class Prop_SunRays extends Drawable {
    constructor(scene, cls) {
        super(scene, cls);

        this.matrixBuffer = new Float32Array(MAX_RAYS * 16);
        this.flags = new Array(MAX_RAYS).fill(false);

        this.ray_direction = new BABYLON.Vector3(-0.2, 0.9, 0.0);
        this.prev_tod = 0;

        this.tmp_position = new BABYLON.Vector3(0,0,0);
        this.QuatIdentity = BABYLON.Quaternion.Identity();
        this.tmp_matrix = new BABYLON.Matrix();
        this.tmp_quaternion = new BABYLON.Quaternion();
        this.create();
    }

    create() {

        // メッシュ
        this.mesh = BABYLON.MeshBuilder.CreateBox( "sunRay", {width: 0.8, depth: 0.5, height: RAY_LENGTH}, this.scene);
        this.mesh.bakeTransformIntoVertices(
            BABYLON.Matrix.Translation(0, - RAY_LENGTH * 0.5, 0)
        );

        // カスタムシェーダ
        const shader = new BABYLON.ShaderMaterial("SunRayShader", this.scene,
            { vertex: "sunRay", fragment: "sunRay", },
            { attributes: ["position", "uv", "world0", "world1", "world2", "world3" ],
              uniforms: ["viewProjection", "time", "lightDir"],
              samplers: ["diffuseSampler"] }
        );
        shader.backFaceCulling = false;
        shader.alphaMode = BABYLON.Engine.ALPHA_ADD;
        shader.alpha = 0.01; // Shaderのalphaを有効にするために 0.0 や 1.0 にはしないこと
        shader.setFloat("alpha", 0.0);
        shader.setVector3("lightDir", this.ray_direction);
        this.mesh.material = shader;
        this.shader = shader;

        // 全スロットをスケール0の行列で初期化
        for (let i = 0; i < MAX_RAYS; i++) {
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

    add_sunRay(pos) {
        let index = this.flags.findIndex(f => f === false);
        if (index === -1) {
            console.warn("No free ray slot");
            return;
        }
        pos.y += RAY_LENGTH * 0.45 + pos.z + 0.2; // 上端が見えないように奥ほど上げる
        this._writeMatrix(index, DEFAULT_SCALE, pos);
        this.flags[index] = true;
        this.mesh.thinInstanceBufferUpdated("matrix"); // バッファ更新をGPUに通知
    }

    initialize(){
        this.flags = new Array(MAX_RAYS).fill(false);
        for (let i = 0 ; i < MAX_RAYS ; i++){
            const pos = new BABYLON.Vector3(Math.random()*20.0-10.0, 0, Math.random()*18.0-5.0);
            this.add_sunRay(pos);
        }
    }

    update(time, delta) {
        const tod = GameState.timeOfDay;
        if (0.08 < tod && tod < 0.18){
            const alpha = ((tod - 0.08) / (0.18 - 0.08))*RAY_ALPHA;
            this.shader.setFloat("alpha", alpha);
        }
        if (0.32 < tod && tod < 0.42){
            const alpha = (1.0 - (tod - 0.32) / (0.42 - 0.32))*RAY_ALPHA;
            this.shader.setFloat("alpha", alpha);
        }
        if (0.0 < tod && tod < 0.5){
            const angle = tod * Math.PI * 2;
            this.ray_direction.set(Math.cos(angle), Math.sin(angle), 0.0);
            this.shader.setVector3("lightDir", this.ray_direction);
        }
        if (tod < 0.08 || 0.42 < tod){
            this.shader.setFloat("alpha", 0.0);
        }
        if (this.prev_tod < 0.75 && tod >= 0.75){
            this.initialize();
            // console.log("ray initialize:", tod);
        }
        this.prev_tod = tod;
    }

    dispose(){
        if (this.mesh){
            this.mesh.dispose(false, true);
            this.mesh = null;
        }
    }
}