// MainExec.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from '../GameState.js';
import { Player } from '../objects/player.js';
import { Prop_Bubbles } from '../objects/prop_bubbles.js';
import { Prop_Remains } from '../objects/prop_remains.js';
import { Prop_SunRays } from '../objects/prop_sunRays.js';

export class Exec {
    constructor(scene) {
        this.scene = scene;
        GameState.player = new Player(this.scene, "Player");
        GameState.bubbles = new Prop_Bubbles(this.scene, "Bubbles");
        GameState.remains = new Prop_Remains(this.scene, "Remains");
        GameState.sunRays = new Prop_SunRays(this.scene, "SunRays");

        // 距離計算用のテンポラリVector3
        this.tmpDiff    = new BABYLON.Vector3();
        this.tmpNormal  = new BABYLON.Vector3();
        this.tmpImpulse = new BABYLON.Vector3();
    }

    update(time, delta){
        // ◆定期的なオブジェクト生成（生態系の更新）
        GameState.spawn_scheduler.update(time, delta);

        // ◆プレイヤー操作
        GameState.player.update(time, delta);

        // ◆小道具系の移動
        GameState.bubbles.update(time, delta); //泡
        GameState.remains.update(time, delta); //遺物
        GameState.sunRays.update(time, delta); //光の筋

        // ◆精霊の管理
        for (let i = GameState.spirits.length - 1; i >= 0; i--) {
            const spirit = GameState.spirits[i];

            spirit.update(time, delta);
            if (!spirit.alive) {
                GameState.spawn.deactivate_spirit(spirit);
                GameState.spirits.splice(i, 1);
                continue;
            }
        }

        // ◆精霊同士の当たり判定
        for (let i = 0; i < GameState.spirits.length - 1; i++){
            const obj1 = GameState.spirits[i];
            if (!obj1.alive || obj1.dying || !obj1.isCollidable) continue;
            for (let j = i + 1; j < GameState.spirits.length; j++){
                const obj2 = GameState.spirits[j];
                if (!obj2.alive ||obj2.dying || !obj2.isCollidable) continue;
                this.check_collision(obj1, obj2);
            }
        }

        // ◆捕食判定
        for (let i = 0; i < GameState.spirits.length; i++){
            const obj1 = GameState.spirits[i];
            if (obj1.dying || obj1.genome.predation_classes.length === 0) continue;
            for (let j = 0; j < GameState.spirits.length; j++){
                const obj2 = GameState.spirits[j];
                if (obj1 === obj2) continue;
                if (obj2.dying || !obj1.genome.predation_classes.includes(obj2.class_name)) continue;
                if (this.check_predation(obj1, obj2)){
                    // console.log("predation:", obj1.class_name, obj2.class_name);
                    // obj1.control_velocity.scaleInPlace(0.5); //[TEST]捕食したら減速
                    obj2.set_dying();
                    GameState.spawn.spirit_class_state[obj2.class_name].num_preyed += 1;

                    obj1.hp = Math.min(obj1.genome.hp_max, obj1.hp + obj2.hp); //[TEST] 捕食相手のHPを取得

                    if (obj2.class_name === "Spirit_Plankton"){
                        GameState.spawn.activate_effect("Effect_Feeding", obj2.root.position, {size : obj2.collisionRadius});
                        GameState.asset.se.feeding.play_3D(obj2.root.position);
                    } else {
                        GameState.spawn.activate_effect("Effect_Predation", obj2.root.position, {size : obj2.collisionRadius});
                        GameState.asset.se.predation.play_3D(obj2.root.position);
                    }

                    // [TEST]
                    GameState.bubbles.add_bubble(obj2.root.position);
                    GameState.remains.add_remain(obj2.root.position, obj2.remain_color, obj2.collisionRadius);
                }
            }
        }

        // ◆エフェクトの管理
        for (let i = GameState.effects.length - 1; i >= 0; i--) {
            const effect = GameState.effects[i];

            effect.update(time, delta);
            if (!effect.alive) {
                GameState.spawn.deactivate_effect(effect);
                GameState.effects.splice(i, 1);
                continue;
            }
        }

    } // End of update

    dispose(){
        if ( GameState.player ){
            GameState.player.dispose();
            GameState.player = null;
        }
        if ( GameState.bubbles ){
            GameState.bubbles.dispose();
            GameState.bubbles = null;
        }
        if ( GameState.remains ){
            GameState.remains.dispose();
            GameState.remains = null;
        }
        if ( GameState.sunRays ){
            GameState.sunRays.dispose();
            GameState.sunRays = null;
        }
    }

    // 捕食位置の当たり判定
    check_predation(predator, prey){

        const dx = prey.root.position.x - predator.predation_position.x;
        const dy = prey.root.position.y - predator.predation_position.y;
        const dz = prey.root.position.z - predator.predation_position.z;
        const distSq = dx*dx + dy*dy + dz*dz;

        const radius_sum = prey.genome.collision_radius + predator.genome.predation_radius;

        return distSq < radius_sum * radius_sum;
    }

    // Collidableクラス間の当たり判定
    check_collision(obj1, obj2){

        const dx = obj2.root.position.x - obj1.root.position.x;
        const dy = obj2.root.position.y - obj1.root.position.y;
        const dz = obj2.root.position.z - obj1.root.position.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        const radius_sum = obj1.collisionRadius + obj2.collisionRadius;

        if (distSq >= radius_sum * radius_sum) return null;

        // 衝突方向（normal は、obj1 から見た obj2 の相対位置）
        obj2.root.position.subtractToRef(obj1.root.position, this.tmpDiff);

        // 法線（至近距離の場合、ランダム化）
        if (distSq < 0.000001) {
            const seed = Math.rondom();
            this.tmpNormal = new BABYLON.Vector3(Math.cos(seed), 0, Math.sin(seed)).normalize();
            console.log("too near");
        } else {
            this.tmpDiff.normalizeToRef(this.tmpNormal);
        }

        // 重なり解決（moveWithCollisionを使っていないので位置を直接更新）
        const overlap = radius_sum - Math.sqrt(distSq);
        if (overlap > GLOBALS.COLLIDABLE.OVERLAP_RESOLUTION_THRESHOLD){
            // console.log("overlap:", overlap);
            this.tmpNormal.scaleToRef(- overlap * GLOBALS.COLLIDABLE.OVERLAP_RESOLUTION_RATIO, this.tmpDiff);
            obj1.root.position.addInPlace(this.tmpDiff);
            this.tmpNormal.scaleToRef(  overlap * GLOBALS.COLLIDABLE.OVERLAP_RESOLUTION_RATIO, this.tmpDiff);
            obj2.root.position.addInPlace(this.tmpDiff);
        }

        // 運動量を交換 (obj1 から見た obj2 の相対速度を計算)
        const vRelX = obj2.velocity.x - obj1.velocity.x;
        const vRelY = obj2.velocity.y - obj1.velocity.y;
        const vRelZ = obj2.velocity.z - obj1.velocity.z;
        const dot = vRelX * this.tmpNormal.x + vRelY * this.tmpNormal.y + vRelZ * this.tmpNormal.z;
        if (dot > 0) return null; //既に離れようとしている時には処理しない

        const e = 0.3;    //e=1.0:完全弾性、e=0.0:完全非弾性
        const j = -(1 + e) * dot / (1 / obj1.mass + 1 / obj2.mass);
        const impX = this.tmpNormal.x * j;
        const impY = this.tmpNormal.y * j;
        const impZ = this.tmpNormal.z * j;
        this.tmpImpulse.set(impX, impY, impZ);
        obj1.add_impulse( this.tmpImpulse.scale(-1) );
        obj2.add_impulse( this.tmpImpulse );
        obj1.collided = true;
        obj2.collided = true;

        // [TEST]
        GameState.bubbles.add_bubble(obj2.root.position);

        // ヒットした時に対象を光らせる
        obj1.flash();
        obj2.flash();
        if (this.tmpImpulse.length() > 0.2){
            GameState.asset.se.collision.play_3D(obj1.root.position);
            // console.log("impulse:", impulse.length(), dot);
        }
        return this.tmpImpulse;
    }
} // End of Exec