// effect_predation.js
import { GameState } from "../GameState.js";
import { Effect } from "./base_effect.js";

const MANUAL_EMIT_COUNT = 40;

export class Effect_Feeding extends Effect {

    constructor(scene, class_name){
        super(scene, class_name);
        this.ps = null;
        this.size_ratio = 0.5;
        this.activated_time = 0;
        this.min_life_time = 1.6; 

        this.create();
    }

    create(){
        this.particleTexture = GameState.asset.texture.particle;

        // パーティクルシステムの生成
        const ps = new BABYLON.ParticleSystem("explosion", 200, this.scene);
        // disposeする場合はthis.particleTexture.clone()しないと全パーティクルが消えるので注意
        ps.particleTexture = this.particleTexture;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

        const size = 0.6;
        ps.addSizeGradient(0.0 * size, 0.4 * size);  // 最初は小さく
        ps.addSizeGradient(0.4 * size, 1.0 * size);  // 一瞬で大きく
        ps.addSizeGradient(1.0 * size, 0.0 * size) ; // 最後は消える

        ps.minLifeTime = 0.3;
        ps.maxLifeTime = 0.5;

        ps.minEmitPower = 1.0;
        ps.maxEmitPower = 1.2;
        ps.addVelocityGradient(0, 1.0); // 最初は速い
        ps.addVelocityGradient(1.0, 0.05); // 最後はほぼ止まる
        ps.emitRate = 300; 
        // ps.manualEmitCount = MANUAL_EMIT_COUNT; // 1回で放出するパーティクルの総数
        const radius = 0.01; 
        const sphereEmitter = new BABYLON.SphereParticleEmitter(radius);
        ps.particleEmitterType = sphereEmitter;

        ps.gravity = new BABYLON.Vector3(0, -9.81 * 0.1, 0); 
        
        // 色
        ps.color1 = new BABYLON.Color4(0.0, 1.0, 0.6, 1.0);
        ps.color2 = new BABYLON.Color4(0.0, 0.8, 0.1, 0.8);
        ps.colorDead = new BABYLON.Color4(0.0, 0.2, 0.1, 0.0);

        // 再利用するため
        ps.disposeOnStop = false;

        this.ps = ps;
        this.ps.start(); //再利用時にはstart()を呼ばない
    }

    activate(pos, params){
        if (params && params.size){
            this.size_ratio = params.size * 5.0;
        }

        this.root.position.copyFrom(pos);
        this.root.scaling.set(this.size_ratio, this.size_ratio, this.size_ratio);
        this.ps.emitter = this.root;

        this.ps.manualEmitCount = MANUAL_EMIT_COUNT; //(再)発火
        this.activated_time = 0;

        super.activate(pos, params);
    }
    
    deactivate(){
        super.deactivate();
    }


    update(time, delta){
        this.activated_time += delta / 1000;
        if (this.activated_time > this.min_life_time && this.ps.getActiveCount() === 0){
            this.alive = false;
        }
        super.update(time, delta);
    }

    dispose(){
        if (this.ps){
            this.ps.dispose();
            this.ps = null;
        }
        super.dispose();
    }
}