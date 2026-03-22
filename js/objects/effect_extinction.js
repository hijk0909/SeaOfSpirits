// effect_extinction.js
import { GameState } from "../GameState.js";
import { Effect } from "./base_effect.js";

const MANUAL_EMIT_COUNT = 40;

export class Effect_Extinction extends Effect {

    constructor(scene, class_name, type_name){
        super(scene, class_name, type_name);
        this.ps = null;
        this.size_ratio = 1.0;
    }

    create(params){
        this.particleTexture = GameState.asset.texture.particle;

        // パーティクルシステムの生成
        const ps = new BABYLON.ParticleSystem("extinction", 2000, this.scene);
        // disposeする場合はclone()しないと全パーティクルが消えるので注意
        ps.particleTexture = this.particleTexture.clone();
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
        /*
        ps.minSize = 0.2;
        ps.maxSize = 0.3;
        */

        const size = 0.4;
        ps.addSizeGradient(0.0 * size, 0.4 * size);  // 最初は小さく
        ps.addSizeGradient(0.4 * size, 1.0 * size);  // 一瞬で大きく
        ps.addSizeGradient(1.0 * size, 0.0 * size) ; // 最後は消える

        ps.minLifeTime = 1.6;
        ps.maxLifeTime = 2.4;

        // エミッターの位置を設定 (花火が始まる位置)
        // ps.emitter = position.clone();
        ps.minEmitPower = 2.0;
        ps.maxEmitPower = 2.2;
        ps.addVelocityGradient(0, 1.0); // 最初は速い
        ps.addVelocityGradient(1.0, 0.05); // 最後はほぼ止まる
        ps.emitRate = 300; 
        // ps.manualEmitCount = MANUAL_EMIT_COUNT; // 1回で放出するパーティクルの総数
        const radius = 0.01; 
        const sphereEmitter = new BABYLON.SphereParticleEmitter(radius);
        ps.particleEmitterType = sphereEmitter;

        ps.gravity = new BABYLON.Vector3(0, -9.81 * 0.8, 0); 
        
        // 色
        ps.color1 = new BABYLON.Color4(0.6, 0.9, 1.0, 1.0);
        ps.color2 = new BABYLON.Color4(0.1, 0.4, 1.0, 0.8);
        ps.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0.0);

        // 再利用するため
        ps.disposeOnStop = false;

        this.ps = ps;
        this.ps.start(); //再利用時にはstart()を呼ばない

        super.create(params)
    }

    activate(pos, params){
        if (params && params.size){
            this.size_ratio = params.size * 1.9;
        }

        this.root.position.copyFrom(pos);
        this.root.scaling.set(this.size_ratio, this.size_ratio, this.size_ratio);
        this.ps.emitter = this.root;

        this.ps.manualEmitCount = MANUAL_EMIT_COUNT; //（再）発火

        super.activate(pos, params);
    }
    
    deactivate(){
        super.deactivate();
    }

    update(time, delta){
        if (this.ps.getActiveCount() === 0){
            this.alive = false;
        }
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