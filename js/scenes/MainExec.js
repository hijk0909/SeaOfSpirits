// MainExec.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from '../GameState.js';
import { Player } from '../objects/player.js';
import { Bubbles } from '../objects/bubbles.js';

export class Exec {
    constructor(scene) {
        this.scene = scene;
        GameState.player = new Player(this.scene, "Player");
        GameState.bubbles = new Bubbles(this.scene, "Bubbles");

        this.max_plankton = 100;
        this.period_plankton = 1000;
        this.count_plankton = this.period_plankton;

        this.max_virus = 100;
        this.period_virus = 1130;
        this.count_virus = this.period_virus;

        this.max_fish = 50;
        this.period_fish = 3000;
        this.count_fish = this.period_fish;

        this.max_jelly = 20;
        this.period_jelly = 13500;
        this.count_jelly = this.period_jelly;

        this.max_shark = 3;
        this.period_shark = 81900;
        this.count_shark = this.period_shark;

        this.max_whale = 2;
        this.period_whale = 198000;
        this.count_whale = this.period_whale;

        // 距離計算用のテンポラリVector3
        this.tmpDiff   = new BABYLON.Vector3(0,0,0);
        this.tmpNormal = new BABYLON.Vector3(0,0,0);
    }

    count_class(class_name) {
        return GameState.spirits.filter(s => s.class_name === class_name).length;
    }

    update(time, delta){

        // [TEST] ◆テスト生成
        this.count_plankton -= delta;
        if (this.count_plankton < 0){
            this.count_plankton = this.period_plankton;
            if (this.count_class("Spirit_Plankton") < this.max_plankton){
                const u = Math.random();
                const v = Math.random();

                const theta = Math.acos(2 * u - 1); // 0〜π
                const phi = 2 * Math.PI * v;        // 0〜2π

                const x = Math.sin(theta) * Math.cos(phi);
                const y = Math.sin(theta) * Math.sin(phi);
                const z = Math.cos(theta);

                const pos = new BABYLON.Vector3(x, y, z).scale(20);

                GameState.spawn.activate("Spirit_Plankton", 0, pos);
            }
        }

        this.count_virus -= delta;
        if (this.count_virus < 0){
            this.count_virus = this.period_virus;
            if (this.count_class("Spirit_Virus") < this.max_virus){
                const u = Math.random();
                const v = Math.random();

                const theta = Math.acos(2 * u - 1); // 0〜π
                const phi = 2 * Math.PI * v;        // 0〜2π

                const x = Math.sin(theta) * Math.cos(phi);
                const y = Math.sin(theta) * Math.sin(phi);
                const z = Math.cos(theta);

                const pos = new BABYLON.Vector3(x, y, z).scale(19);

                GameState.spawn.activate("Spirit_Virus", 0, pos);
            }
        }

        this.count_fish -= delta;
        if (this.count_fish < 0){
            this.count_fish = this.period_fish;
            if (this.count_class("Spirit_Fish") < this.max_fish){
                const pos = new BABYLON.Vector3(Math.random()*10 - 5,Math.random()*10 - 5,20);
                GameState.spawn.activate("Spirit_Fish", 0, pos);
            }
        }

        this.count_jelly -= delta;
        if (this.count_jelly < 0){
            this.count_jelly = this.period_jelly;
            if (this.count_class("Spirit_Jelly") < this.max_jelly){
                const pos = new BABYLON.Vector3(Math.random()*10 - 5,Math.random()*10 - 5,20);
                GameState.spawn.activate("Spirit_Jelly", 0, pos);
            }
        }

        this.count_shark -= delta;
        if (this.count_shark < 0){
            this.count_shark = this.period_shark;
            if (this.count_class("Spirit_Shark") < this.max_shark){
                const pos = new BABYLON.Vector3(Math.random()*10 - 5,Math.random()*10 - 5,20);
                GameState.spawn.activate("Spirit_Shark", 0, pos);
            }
        }

        this.count_whale -= delta;
        if (this.count_whale < 0){
            this.count_whale = this.period_whale;
            if (this.count_class("Spirit_Whale") < this.max_whale){
                const pos = new BABYLON.Vector3(Math.random()*10 - 5,Math.random()*10 - 5,20);
                GameState.spawn.activate("Spirit_Whale", 0, pos);
            }
        }


        // ◆プレイヤー操作
        GameState.player.update(time, delta);

        // ◆泡移動
        GameState.bubbles.update(time, delta);

        // ◆精霊の管理
        for (let i = GameState.spirits.length - 1; i >= 0; i--) {
            const spirit = GameState.spirits[i];

            spirit.update(time, delta);
            if (!spirit.isAlive()) {
                GameState.spawn.deactivate(spirit);
                GameState.spirits.splice(i, 1);
                continue;
            }
        }

        // ◆精霊同士の当たり判定
        for (let i = 0; i < GameState.spirits.length - 1; i++){
            const obj1 = GameState.spirits[i];
            if (obj1.dying || !obj1.isCollidable) continue;
            for (let j = i + 1; j < GameState.spirits.length; j++){
                const obj2 = GameState.spirits[j];
                if (obj2.dying || !obj2.isCollidable) continue;
                this.check_collision(obj1, obj2);
            }
        }

        // ◆捕食判定
        for (let i = 0; i < GameState.spirits.length; i++){
            const obj1 = GameState.spirits[i];
            if (obj1.dying || obj1.predation_classes.length === 0) continue;
            for (let j = 0; j < GameState.spirits.length; j++){
                const obj2 = GameState.spirits[j];
                if (obj1 === obj2) continue;
                if (obj2.dying || !obj1.predation_classes.includes(obj2.class_name)) continue;
                if (this.check_predation(obj1, obj2)){
                    // console.log("predation:", obj1.class_name, obj2.class_name);
                    obj1.control_velocity.copyFrom(GLOBALS.ZERO_VECTOR); //[TEST]捕食したら停止
                    obj2.set_dying();

                    obj1.hp = Math.min(obj1.hp_max, obj1.hp + obj2.hp); //[TEST] 捕食相手のHPを取得

                    GameState.spawn.activate("Effect_Predation", 0, obj2.root.position);
                    GameState.asset.se.predation.play_3D(obj2.root.position);

                    // [TEST]
                    GameState.bubbles.add_bubble(obj2.root.position);
                }
            }
        }

        // エフェクトの管理
        for (let i = GameState.effects.length - 1; i >= 0; i--) {
            const effect = GameState.effects[i];

            effect.update(time, delta);
            if (!effect.isAlive()) {
                GameState.spawn.deactivate(effect);
                GameState.effects.splice(i, 1);
                continue;
            }
        }

    } // End of update
/*
    // 汎用の当たり判定
    check_hit(pos1, rad1, pos2, rad2){
        const distance = BABYLON.Vector3.Distance(pos1, pos2);
        return (distance < rad1 + rad2);
    }
*/
    // Spiritsクラス間の当たり判定
    check_predation(predator, prey){

        const dx = prey.root.position.x - predator.root.position.x;
        const dy = prey.root.position.y - predator.root.position.y;
        const dz = prey.root.position.z - predator.root.position.z;
        const distSq = dx*dx + dy*dy + dz*dz;

        const radius_sum = prey.collisionRadius + predator.predation_radius;

        return distSq < radius_sum * radius_sum;
    }

    // Collidableクラス間の当たり判定
    check_collision(obj1, obj2){

        const dx = obj2.root.position.x - obj1.root.position.x;
        const dy = obj2.root.position.y - obj1.root.position.y;
        const dz = obj2.root.position.z - obj1.root.position.z;
        const distSq = dx*dx + dy*dy + dz*dz;

        const radius_sum = obj1.collisionRadius + obj2.collisionRadius;

        let impulse = null;
        if (distSq < radius_sum * radius_sum){
            // 衝突方向（normal は、obj1 から見た obj2 の相対位置）
            obj2.root.position.subtractToRef(obj1.root.position, this.tmpDiff)

            // const diff = obj2.root.position.clone().subtract(obj1.root.position);

            if (distSq < 0.001) { //至近距離の場合、法線方向をランダム化
                const seed = obj1.id || 1;
                // normal = new BABYLON.Vector3(0,0,-1);
                this.tmpNormal = new BABYLON.Vector3(Math.cos(seed), 0, Math.sin(seed)).normalize();  
            } else {
                this.tmpDiff.normalizeToRef(this.tmpNormal);
            }

            // 重なり解決（速度ベクトル更新）(重なりが大きいほど強く反発)
            const overlap = radius_sum - Math.sqrt(distSq);
            const overlap_repulsion = this.tmpNormal.scale(overlap * GLOBALS.COLLIDABLE.OVERLAP_REPULSION_COEFFICIENT); // overlap比例の反発係数
            obj1.add_overlap_impulse(overlap_repulsion.scale(-1));
            obj2.add_overlap_impulse(overlap_repulsion);
            // if (overlap_repulsion.length() > 0.15){ console.log("repulsin:", overlap_repulsion.length()); }

            // 運動量を交換 (velocity_relative は obj1 から見た obj2 の相対速度)
            const velocity_relative = obj2.velocity.clone().subtract(obj1.velocity);
            const dot = BABYLON.Vector3.Dot(velocity_relative, this.tmpNormal);
            const e = 0.3;    //e=1.0:完全弾性、e=0.0:完全非弾性
            impulse = this.tmpNormal.scale(-(1+e) * dot / (1/obj1.mass + 1/obj2.mass));
            obj1.add_impulse( impulse.scale(-1));
            obj2.add_impulse( impulse );

            obj1.collided = true;
            obj2.collided = true;

            // [TEST]
            GameState.bubbles.add_bubble(obj2.root.position);

            // ヒットした時に対象を光らせる
            if (impulse.length() > 0.2){
                obj1.flash();
                obj2.flash();
                GameState.asset.se.collision.play_3D(obj1.root.position);
                // console.log("impulse:", impulse.length(), dot);
            }
            return impulse;
        }
    }
} // End of Exec