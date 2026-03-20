// effect_extinction.js
import { GameState } from "../GameState.js";
import { Effect } from "./base_effect.js";

const MANUAL_EMIT_COUNT = 40;

export class Effect_Extinction extends Effect {

    constructor(scene, class_name){
        super(scene, class_name);
    }

    create(type=""){
        this.particleTexture = GameState.asset.texture.particle;

        // パーティクルシステムの生成
        const ps = new BABYLON.ParticleSystem("extinction", 2000, this.scene);
        // 再利用せずdisposeする場合はclone()しないと全パーティクルが消えるので注意
        ps.particleTexture = this.particleTexture.clone();
        // ps.particleTexture = this.particleTexture;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
        ps.minSize = 0.1;
        ps.maxSize = 0.3;
        ps.addSizeGradient(0, 0.1);   // 最初は小さく
        ps.addSizeGradient(0.2, 1.0); // 一瞬で大きく
        ps.addSizeGradient(1.0, 0.0); // 最後は消える
        ps.minLifeTime = 0.8;
        ps.maxLifeTime = 1.2;

        // エミッターの位置を設定 (花火が始まる位置)
        // ps.emitter = position.clone();
        ps.minEmitPower = 2.0;
        ps.maxEmitPower = 2.2;
        ps.addVelocityGradient(0, 1.0); // 最初は速い
        ps.addVelocityGradient(1.0, 0.05); // 最後はほぼ止まる
        ps.emitRate = 300; 
        ps.manualEmitCount = MANUAL_EMIT_COUNT; // 1回で放出するパーティクルの総数
        const radius = 0.01; 
        const sphereEmitter = new BABYLON.SphereParticleEmitter(radius);
        ps.particleEmitterType = sphereEmitter;

        ps.gravity = new BABYLON.Vector3(0, -9.81 * 0.8, 0); 
        
        // 色
        ps.color1 = new BABYLON.Color4(0.6, 0.9, 1.0, 1.0);
        ps.color2 = new BABYLON.Color4(0.1, 0.4, 1.0, 0.8);
        ps.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0.0);

        // 再利用するので disposeOnSop は false → メモリリーク対策で true
        ps.disposeOnStop = true;

        // 終了時のイベントを追加
        this._particleObserver = this.scene.onBeforeRenderObservable.add(() => {
            // console.log("effect EXTI observable", ps.isStarted(), ps.getActiveCount());
            // if (!ps.isStarted() && ps.getActiveCount() === 0) {
            if (!ps.isStarted() && ps.getActiveCount() === 0) {
                this.alive = false;
                this.scene.onBeforeRenderObservable.remove(this._particleObserver);
            }
        });

        this.ps = ps;
        this.ps.start(); //再利用時にはstart()を呼ばない
    }

    activate(pos){
        this.ps.manualEmitCount = MANUAL_EMIT_COUNT;
        this.ps.emitter = pos.clone();
        super.activate();
    }
    
    deactivate(){
        super.deactivate();
    }

    update(time, delta){
        super.update(time, delta);
    }

    dispose(){
        if (this.core_mesh){
            // console.log("core_mesh EXTI disposed");
            this.core_mesh.dispose();
            this.core_mesh = null;
        }
        super.dispose();
    }
}