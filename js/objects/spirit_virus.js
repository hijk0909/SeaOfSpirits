// spirit_virus.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { MyDraw } from "../utils/DrawUtils.js";

const HP_DECREASE = 0.002;
const HP_ABSORB = 0.04;

const INFECTING_COLOR = new BABYLON.Color4(1.0, 0.0, 0.3, 1.0);
const DRIFTING_COLOR = new BABYLON.Color4(0.05, 0, 0.01, 1.0);

// ウイルス
export class Spirit_Virus extends Spirit {

    constructor(scene, class_name, generation){
        super(scene, class_name, generation);

        // クラス遺伝子
        this.genome.hp_max = 10;
        this.genome.hp_decrease = HP_DECREASE;
        this.genome.is_collidable = false;
        this.genome.collision_radius = 0.15;

        // クラス固有の設定
        this.index = 0;
        this.base_color = new BABYLON.Color4();
        this.scale = new BABYLON.Vector3();
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

        this.genome.disp_scale = Math.min(0.8, 0.08 + this.generation * 0.01);
        const s = this.genome.disp_scale;
        this.scale.copyFromFloats(s,s,s);
    }

    _set_shared_materials(){
        this.remain_color.copyFrom(INFECTING_COLOR);
    }

    _create_body(){
    }

    activate(pos){
        this.infecting = false;
        super.activate(pos);

        this.base_color.copyFrom(DRIFTING_COLOR);
        this.base_color.a = 1.0;

        this.index = GameState.thinManager_virus.register_instance();
        if (this.index === null){
            this.alive = false;
        } else {
            GameState.thinManager_virus.set_matrix(this.index, this.scale, this.root.position);
            GameState.thinManager_virus.set_color(this.index, this.base_color);
        }
    }

    deactivate(){
        if (this.index !== null){
            GameState.thinManager_virus.unregister_instance(this.index);
            this.index = null;
        }
        super.deactivate();
    }

    update(time, delta){
        if (this.infecting){
            // ◆感染状態
            if (!this.infectionObject || !this.infectionObject.alive || this.infectionObject.dying){
                this.infecting = false;
                this.hp_decrease = this.genome.hp_decrease;
                GameState.thinManager_virus.set_color(this.index, DRIFTING_COLOR);
                // [TEST]
                GameState.bubbles.add_bubble(this.root.position);
                // console.log("[VIRUS] Parent DIE");
            } else {
                const newWorldMat = this.infectionMatrix.multiply(this.infectionObject.root.getWorldMatrix());
                newWorldMat.decompose(this.tmpScale, this.tmpRot, this.tmpPos);
                this.root.position  = this.tmpPos;
                // this.root.rotationQuaternion = this.tmpRot;
                this.infectionObject.hp = Math.max(0, this.infectionObject.hp - HP_ABSORB);
                this.hp = Math.min(this.genome.hp_max, this.hp + HP_ABSORB);

                GameState.thinManager_virus.set_matrix(this.index, this.scale, this.root.position, this.tmpRot);

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
                        GameState.thinManager_virus.set_color(this.index, INFECTING_COLOR);

                        this.infectionObject = spirit;
                        const worldMatA = this.root.getWorldMatrix();
                        const worldMatB = spirit.root.getWorldMatrix();
                        const invWorldMatB = BABYLON.Matrix.Invert(worldMatB);
                        this.infectionMatrix = worldMatA.multiply(invWorldMatB);
                        this.control_velocity.copyFrom(GLOBALS.ZERO_VECTOR);

                        // [TEST]
                        GameState.bubbles.add_bubble(this.root.position);
                        // 被感染数の記録
                        GameState.spawn.spirit_class_state[spirit.class_name].num_infected += 1;
                        break;
                    }
                }
            }            
        }
        super.update(time, delta);

        GameState.thinManager_virus.set_position(this.index, this.root.position);
        if (this.dying){
            this.base_color.a = this.dying_ratio;
            GameState.thinManager_virus.set_color(this.index, this.base_color);
        }
    }

    dispose(){
        if (this.index !== null){
            GameState.thinManager_virus.unregister_instance(this.index);
            this.index = null;
        }
        super.dispose();
    }
}