// base_collidable.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Drawable } from "./base_drawable.js";

const TMP_MATRIX = new BABYLON.Matrix(); //重なり解消計算で使うワーク

export class Collidable extends Drawable {

    constructor(scene, class_name){
        super(scene, class_name);

        this.root.rotationQuaternion = new BABYLON.Quaternion(); //（注）this.root.rotation は使えなくなる
        this.isCollidable = true; //自前の衝突判定を行うか
        this.collisionRadius = 0.5; //自前の衝突判定用の半径
        this.mass = 1.0;

        this.control_velocity = new BABYLON.Vector3();
        this.external_velocity = new BABYLON.Vector3();
        this.external_velocity_damping = 0.98;
        this.repulse_velocity = new BABYLON.Vector3();
        this.environment_velocity = new BABYLON.Vector3();
        this.velocity = new BABYLON.Vector3();

        this.rotate_speed = 0.8;

        this.oscilation_resolver = new OscillationResolver(this);
        this.actual_move = new BABYLON.Vector3();
    }

    create(){
        super.create();
    }

    get_up_vector(){
        return BABYLON.Vector3.TransformNormal(BABYLON.Axis.Y, this.root.getWorldMatrix()).normalize();
    }
    get_forward_vector(){
        return BABYLON.Vector3.TransformNormal(BABYLON.Axis.Z, this.root.getWorldMatrix()).normalize();
    }

    add_impulse(impulse){
        this.external_velocity.addInPlace(impulse.scale(1/this.mass * GLOBALS.COLLIDABLE.IMPULSE_VELOCITY_RATIO));
        if (this.external_velocity.length() > GLOBALS.COLLIDABLE.MAX_EXTERNAL_VELOCITY){
            this.external_velocity.normalize().scaleInPlace(GLOBALS.COLLIDABLE.MAX_EXTERNAL_VELOCITY);
        }
    }

    add_overlap_impulse(impulse) {
        // 反発に微小なランダム回転を加える（5度〜10度の範囲）
        // 物理的なデッドロック（振動）を崩すために、Y軸（上方向）を軸に少し回転
        const randomAngle = (Math.random() * 10 + 5) * (Math.PI / 180);
        const sign = Math.random() > 0.5 ? 1 : -1;
        
        // 回転用クォータニオンの作成
        const rotation = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, randomAngle * sign);
        rotation.toRotationMatrix(TMP_MATRIX);
        // impulseをコピーして回転を適用
        const jitteredImpulse = new BABYLON.Vector3(); 
        BABYLON.Vector3.TransformNormalToRef(impulse, TMP_MATRIX, jitteredImpulse);

        // 加工したベクトルを加算
        this.repulse_velocity.addInPlace(jitteredImpulse);

        // 最大速度のリミッター
        if (this.repulse_velocity.length() > GLOBALS.COLLIDABLE.MAX_REPULSE_VELOCITY) {
            this.repulse_velocity.normalize().scaleInPlace(GLOBALS.COLLIDABLE.MAX_REPULSE_VELOCITY);
        }
    }

    rotate_towards(targetPosition, delta){

        // ターゲット方向ベクトルを取得
        const currentPosition = this.root.position;
        const targetDir = targetPosition.subtract(currentPosition).normalize();
        // メッシュのローカルZ軸 (this.forward) を targetDir に向ける回転を計算
        const targetQuaternion = new BABYLON.Quaternion();
        BABYLON.Quaternion.FromUnitVectorsToRef(
            BABYLON.Axis.Z, 
            targetDir, 
            targetQuaternion
        );
        // console.log("rotate:",targetPosition, this.root.position, targetQuaternion, this.root.rotationQuaternion);
        // 球面線形補間で滑らかに回転
        BABYLON.Quaternion.SlerpToRef(
            this.root.rotationQuaternion,       // 現在の回転
            targetQuaternion,                   // 目標の回転
            0.8 * delta / 1000,                 // 補間率（値が小さいほど滑らかで遅い）
            this.root.rotationQuaternion        // 結果をメッシュのクォータニオンに書き込み
        );
    }

    rotate_to(targetVec, delta){

        const targetDir = targetVec.clone().normalize();
        // メッシュのローカルZ軸 (this.forward) を targetDir に向ける回転を計算
        const targetQuaternion = new BABYLON.Quaternion();
        BABYLON.Quaternion.FromUnitVectorsToRef(
            BABYLON.Axis.Z, 
            targetDir,
            targetQuaternion
        );
        // console.log("rotate:",targetPosition, this.root.position, targetQuaternion, this.root.rotationQuaternion);
        // 球面線形補間で滑らかに回転
        BABYLON.Quaternion.SlerpToRef(
            this.root.rotationQuaternion,       // 現在の回転
            targetQuaternion,                   // 目標の回転
            this.rotate_speed * delta / 1000,   // 補間率（値が小さいほど滑らかで遅い）
            this.root.rotationQuaternion        // 結果をメッシュのクォータニオンに書き込み
        );
    }


    update(time, delta){

        // 速度の計算
        const control_ratio = BABYLON.Scalar.Clamp(1 - this.external_velocity.length() / GLOBALS.COLLIDABLE.CONTROL_LOSS_THRESHOLD, 0, 1);

        this.velocity.copyFrom(this.control_velocity);
        this.velocity.scaleInPlace(control_ratio);
        this.velocity.addInPlace(this.external_velocity);
        this.velocity.addInPlace(this.environment_velocity);

        this.velocity.scaleInPlace(Math.min(delta, 33) / GLOBALS.DELTA);
        // 移動の実行
        // this.root.position.addInPlace(this.velocity.scale(delta/GLOBALS.DELTA));
        this.root.position.addInPlace(this.velocity);

        // 外部からの速度の減衰
        this.external_velocity.scaleInPlace(this.external_velocity_damping);

        // 重なり解消用速度のリセット
        this.repulse_velocity.set(0,0,0);

        // 振動解決
        // this.oscilation_resolver.detect(this.root.position);
        // this.oscilation_resolver.update(time, delta);

        super.update(time, delta);
    }

    dispose(){
        if (this.collider){
            this.collider.dispose();
            this.collider = null;
        }
        super.dispose();
    }
}

// ◆振動の解決クラス
class OscillationResolver {
    constructor(collidable){
        this.collidable = collidable;
        this.oscillation_count = 0;
        this.prev_position = new BABYLON.Vector3(0, 0, 0);
        this.prev_delta = new BABYLON.Vector3(0, 0, 0);
        this.prev_isCollidable = true;
        this.resolve_timer = 0;
    }

    detect(current_position){
        const actual_delta = current_position.subtract(this.prev_position);
        const dot = BABYLON.Vector3.Dot(this.prev_delta.normalize(), actual_delta.normalize());
        if (dot < -0.7){
            // console.log("[OSC] Delta Inversion Found:", this.collidable.id, this.prev_delta, actual_delta, dot);
            this.oscillation_count++;
            if (this.oscillation_count > 10){ //振動検出時間
                this.set_resolver();
            }
        } else {
            this.oscillation_count = Math.max(0, this.oscillation_count -1);
        }
        this.prev_position.copyFrom(current_position);
        this.prev_delta.copyFrom(actual_delta);
    }

    set_resolver(){
        this.resolve_timer = 10; //当たり判定無効化期間（フレーム）
        this.oscillation_count = 0;
        this.prev_isCollidable = this.collidable.isCollidable; //現在状態の退避
        this.collidable.isCollidable = false;
        // console.log("[OSC] Oscillation Found");
    }

    update(time, delta){
        if (this.resolve_timer > 0) {
            this.resolve_timer--;
            if (this.resolve_timer <= 0){
                this.collidable.isCollidable = this.collidable.isCollidable || this.prev_isCollidable;
                // console.log("[OSC] Oscilation Resolver Restored");
            }
        }
    }
} // End of OscilationResolver