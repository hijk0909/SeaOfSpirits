// effect_extinction.js
import { GameState } from "../GameState.js";
import { Effect } from "./base_effect.js";

const MANUAL_EMIT_COUNT = 40;

export class Effect_Extinction extends Effect {

    constructor(scene, class_name){
        super(scene, class_name);
        this.core_mesh = null;
        this.core_time = 0.0;
        this.core_life = 1.0;
        this.core_emissiveColor = new BABYLON.Color3(0.4, 0.7, 1.0);
    }

    create(type=""){
        this.particleTexture = GameState.asset.texture.particle;

        // 爆心
        this.core_mesh = BABYLON.MeshBuilder.CreateSphere("Core", { diameter: 1.2, }, this.scene);

        const mat = new BABYLON.PBRMaterial("coreMat", this.scene);
        mat.emissiveColor = this.core_emissiveColor;
        mat.alpha = 0.7;
        mat.disableLighting = true;
        this.core_mesh.material = mat;
        // this.core_mesh.position = position.clone();

        // パーティクルシステムの生成
        const ps = new BABYLON.ParticleSystem("extinction", 2000, this.scene);
        ps.particleTexture = this.particleTexture.clone();
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
        ps.minSize = 0.1;
        ps.maxSize = 0.5;
        ps.addSizeGradient(0, 0.1);   // 最初は小さく
        ps.addSizeGradient(0.2, 1.0); // 一瞬で大きく
        ps.addSizeGradient(1.0, 0.0); // 最後は消える
        ps.minLifeTime = 0.4;
        ps.maxLifeTime = 0.6;

        // エミッターの位置を設定 (花火が始まる位置)
        // ps.emitter = position.clone();
        ps.minEmitPower = 5.0;
        ps.maxEmitPower = 5.2;
        ps.addVelocityGradient(0, 1.0); // 最初は速い
        ps.addVelocityGradient(1.0, 0.05); // 最後はほぼ止まる
        ps.emitRate = 300; 
        ps.manualEmitCount = MANUAL_EMIT_COUNT; // 1回で放出するパーティクルの総数
        const radius = 0.01; 
        const sphereEmitter = new BABYLON.SphereParticleEmitter(radius);
        ps.particleEmitterType = sphereEmitter;

        ps.gravity = new BABYLON.Vector3(0, -9.81 * 0.1, 0); 
        
        // 色
        ps.color1 = new BABYLON.Color4(0.6, 0.9, 1.0, 1.0);
        ps.color2 = new BABYLON.Color4(0.1, 0.4, 1.0, 0.8);
        ps.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0.0);

        // 再利用するので disposeOnSop は false
        ps.disposeOnStop = false;

        // 終了時のイベントを追加
        this._particleObserver = this.scene.onBeforeRenderObservable.add(() => {
            // console.log("effect EXTI observable", ps.isStarted(), ps.getActiveCount());
            // if (!ps.isStarted() && ps.getActiveCount() === 0) {
            if (ps.getActiveCount() === 0) {
                this.alive = false;
                this.scene.onBeforeRenderObservable.remove(this._particleObserver);
            }
        });

        this.ps = ps;
    }

    activate(pos){
        this.core_mesh.setEnabled(true);
        this.core_mesh.position.copyFrom(pos);
        this.ps.manualEmitCount = MANUAL_EMIT_COUNT;
        this.ps.emitter = pos.clone();
        this.ps.start(); 
        super.activate();
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
            scale = BABYLON.Scalar.Lerp(0.1, 1.3, this.ease_out(tt));
        } else {
            // 後半：急収縮
            const tt = (t - 0.4) / 0.6;
            scale = BABYLON.Scalar.Lerp(1.3, 0.0, this.ease_out(tt));
        }
        this.core_mesh.scaling.set(scale, scale, scale);
        this.core_mesh.material.alpha = BABYLON.Scalar.Lerp(0.8, 0.0, e);

        const intensity = BABYLON.Scalar.Lerp(3.5, 1.0, e);
        this.core_mesh.material.emissiveColor = this.core_emissiveColor.scale(intensity);
    }

    update(time, delta){
        this.update_core(delta);
    }

    dispose(){
        if (this.core_mesh){
            console.log("core_mesh EXTI disposed");
            this.core_mesh.dispose();
            this.core_mesh = null;
        }
        super.dispose();
    }
}