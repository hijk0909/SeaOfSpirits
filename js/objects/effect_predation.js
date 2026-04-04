// effect_predation.js
import { GameState } from "../GameState.js";
import { Effect } from "./base_effect.js";

const MANUAL_EMIT_COUNT = 40;

export class Effect_Predation extends Effect {

    constructor(scene, class_name){
        super(scene, class_name);
        this.ps = null;
        this.size_ratio = 1.0;

        this.core_mesh = null;
        this.core_time = 0.0;
        this.core_life = 1.0;
        this.core_emissiveColor = new BABYLON.Color3(1.0, 0.7, 0.4);

        this.create();
    }

    create(){
        this.particleTexture = GameState.asset.texture.particle;

        // 爆心（コア）
        this.core_mesh = BABYLON.MeshBuilder.CreateSphere("explosionCore", { diameter: 1.2, }, this.scene);

        const mat = new BABYLON.PBRMaterial("coreMat", this.scene);
        mat.emissiveColor = this.core_emissiveColor;
        mat.alpha = 0.7;
        mat.disableLighting = true;
        this.core_mesh.material = mat;

        // パーティクルシステムの生成
        const ps = new BABYLON.ParticleSystem("explosion", 200, this.scene);
        // disposeする場合はthis.particleTexture.clone()しないと全パーティクルが消えるので注意
        ps.particleTexture = this.particleTexture;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

        const size = 0.6;
        ps.addSizeGradient(0.0 * size, 0.4 * size);  // 最初は小さく
        ps.addSizeGradient(0.4 * size, 1.0 * size);  // 一瞬で大きく
        ps.addSizeGradient(1.0 * size, 0.0 * size) ; // 最後は消える

        ps.minLifeTime = 0.6;
        ps.maxLifeTime = 1.0;

        ps.minEmitPower = 2.0;
        ps.maxEmitPower = 2.2;
        ps.addVelocityGradient(0, 1.0); // 最初は速い
        ps.addVelocityGradient(1.0, 0.05); // 最後はほぼ止まる
        ps.emitRate = 300; 
        // ps.manualEmitCount = MANUAL_EMIT_COUNT; // 1回で放出するパーティクルの総数
        const radius = 0.01; 
        const sphereEmitter = new BABYLON.SphereParticleEmitter(radius);
        ps.particleEmitterType = sphereEmitter;

        ps.gravity = new BABYLON.Vector3(0, -9.81 * 0.1, 0); 
        
        // 色
        ps.color1 = new BABYLON.Color4(1.0, 0.9, 0.6, 1.0);
        ps.color2 = new BABYLON.Color4(1.0, 0.4, 0.1, 0.8);
        ps.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0.0);

        // 再利用するため
        ps.disposeOnStop = false;

        this.ps = ps;
        this.ps.start(); //再利用時にはstart()を呼ばない
    }

    activate(pos, params){
        if (params && params.size){
            this.size_ratio = params.size * 5.0;
        }

        this.core_time = 0.0;
        this.core_mesh.setEnabled(true);
        this.core_mesh.position.copyFrom(pos);

        this.root.position.copyFrom(pos);
        this.root.scaling.set(this.size_ratio, this.size_ratio, this.size_ratio);
        this.ps.emitter = this.root;

        this.ps.manualEmitCount = MANUAL_EMIT_COUNT; //(再)発火

        super.activate(pos, params);
    }
    
    deactivate(){
        this.core_mesh.setEnabled(false);
        super.deactivate();
    }


    ease_out(t) {
        return 1 - (1 - t) * (1 - t);
    }

    update_core(delta){
        if (!this.core_mesh) return;
        this.core_time += delta / 1000;
        const t = this.core_time / this.core_life;
        if (t >= 1.0) {
            this.core_mesh.setEnabled(false);
            return;
        }
        const e = this.ease_out(t);

        let scale;
        if (t < 0.4) {
            // 前半：急膨張
            const tt = t / 0.4;
            scale = BABYLON.Scalar.Lerp(0.1, 1.1 * this.size_ratio, this.ease_out(tt));
        } else {
            // 後半：急収縮
            const tt = (t - 0.4) / 0.6;
            scale = BABYLON.Scalar.Lerp(1.1 * this.size_ratio, 0.0, this.ease_out(tt));
        }
        this.core_mesh.scaling.set(scale, scale, scale);
        this.core_mesh.material.alpha = BABYLON.Scalar.Lerp(0.8, 0.0, e);

        const intensity = BABYLON.Scalar.Lerp(3.5, 1.0, e);
        this.core_mesh.material.emissiveColor = this.core_emissiveColor.scale(intensity);
    }

    update(time, delta){
        this.update_core(delta);
        if (this.ps.getActiveCount() === 0){
            this.alive = false;
        }
        super.update(time, delta);
    }

    dispose(){
        if (this.core_mesh){
            // console.log("core_mesh PRED disposed");
            this.core_mesh.dispose();
            this.core_mesh = null;
        }
        if (this.ps){
            this.ps.dispose();
            this.ps = null;
        }
        super.dispose();
    }
}