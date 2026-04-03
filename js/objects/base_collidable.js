// base_collidable.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Drawable } from "./base_drawable.js";

const TMP_MATRIX = new BABYLON.Matrix(); //重なり解消計算で使うワーク
const COLLISION_DISABLED_PERIOD = 1.0;

export class Collidable extends Drawable {

    constructor(scene, class_name, type_name){
        super(scene, class_name, type_name);

        this.root.rotationQuaternion = new BABYLON.Quaternion(); //（注）this.root.rotation は使えなくなる
        this.isCollidable = true; //自前の衝突判定を行うか
        this.collisionRadius = 0.5; //自前の衝突判定用の半径
        this.mass = 1.0;

        this.collided = false; //衝突したか
        this.isCollidable_save = this.isCollidable;
        this.collision_counter = 0; //連続衝突度合
        this.collision_disabled_timer = 0; //衝突無効期間

        this.control_velocity = new BABYLON.Vector3();
        this.external_velocity = new BABYLON.Vector3();
        // this.external_velocity_damping = 0.95;
        // this.repulse_velocity = new BABYLON.Vector3();
        // this.repulse_velocity_damping = 0.70;
        this.environment_velocity = new BABYLON.Vector3();
        this.velocity = new BABYLON.Vector3();

        this.max_speed = 0.1;
        this.rotate_speed = 1.0;

        this.last_direction = new BABYLON.Vector3();
        this.tmp_targetDir = new BABYLON.Vector3();
        this.tmp_targetQuaternion = new BABYLON.Quaternion();
        this.tmp_matrix = new BABYLON.Matrix();
        this.tmp_xAxis = new BABYLON.Vector3();
        this.tmp_yAxis = new BABYLON.Vector3();
        this.tmp_zAxis = new BABYLON.Vector3();
    }

    get_up_vector(){
        return BABYLON.Vector3.TransformNormal(BABYLON.Axis.Y, this.root.getWorldMatrix()).normalize();
    }
    get_forward_vector(){
        return BABYLON.Vector3.TransformNormal(BABYLON.Axis.Z, this.root.getWorldMatrix()).normalize();
    }

    add_impulse(impulse){
        this.external_velocity.addInPlace(impulse.scale(1/this.mass * GLOBALS.COLLIDABLE.IMPULSE_VELOCITY_RATIO));
    }

    rotate_towards(targetPosition, delta){

        // ターゲット方向ベクトル
        this.tmp_targetDir.copyFrom(targetPosition);
        this.tmp_targetDir.subtractInPlace(this.root.position);
        this.tmp_targetDir.normalize();

        // メッシュのローカルZ軸 (this.forward) を targetDir に向ける回転を計算
        BABYLON.Quaternion.FromUnitVectorsToRef(
            BABYLON.Axis.Z, 
            this.tmp_targetDir,
            this.tmp_targetQuaternion
        );
        // 球面線形補間
        BABYLON.Quaternion.SlerpToRef(
            this.root.rotationQuaternion,       // 現在の回転
            this.tmp_targetQuaternion,          // 目標の回転
            0.8 * delta / 1000,                 // 補間率（値が小さいほど滑らかで遅い）
            this.root.rotationQuaternion        // 結果をメッシュのクォータニオンに書き込み
        );
    }

    rotate_to(targetVec, delta) {
        if (targetVec.lengthSquared() < 0.00001) return;

        // ターゲットの方向ベクトル
        this.tmp_targetDir.copyFrom(targetVec);
        this.tmp_targetDir.normalize();
        this.tmp_zAxis.copyFrom(this.tmp_targetDir);

        // ローカルY軸をワールドY軸に近づけるようにグラムシュミット
        const worldY = BABYLON.Axis.Y;
        const dot = BABYLON.Vector3.Dot(this.tmp_zAxis, worldY);
        if (Math.abs(dot) < 0.99) {
            this.tmp_zAxis.scaleToRef(dot, this.tmp_yAxis);
            worldY.subtractToRef(this.tmp_yAxis, this.tmp_yAxis);
            this.tmp_yAxis.normalize();
        } else {
            const worldZ = BABYLON.Axis.Z;
            const dot2 = BABYLON.Vector3.Dot(this.tmp_zAxis, worldZ);
            this.tmp_zAxis.scaleToRef(dot2, this.tmp_yAxis);
            worldZ.subtractToRef(this.tmp_yAxis, this.tmp_yAxis);
            this.tmp_yAxis.normalize();
        }

        // 外積で xAxis を決定
        BABYLON.Vector3.CrossToRef(this.tmp_yAxis, this.tmp_zAxis, this.tmp_xAxis);
        this.tmp_xAxis.normalize();

        // 目標クォータニオンを構築
        BABYLON.Quaternion.RotationQuaternionFromAxisToRef(
            this.tmp_xAxis, this.tmp_yAxis, this.tmp_zAxis,
            this.tmp_targetQuaternion
        );

        // 球面線形補間
        BABYLON.Quaternion.SlerpToRef(
            this.root.rotationQuaternion,
            this.tmp_targetQuaternion,
            this.rotate_speed * delta / 1000 * (targetVec.length() * 6),
            this.root.rotationQuaternion
        );
    }

    look_at(targetVec, delta) {
        if (targetVec.lengthSquared() < 0.00001) return;

        // ターゲット方向への回転行列を計算 (LookAt)
        BABYLON.Matrix.LookAtLHToRef(
            BABYLON.Vector3.ZeroReadOnly, 
            targetVec, 
            BABYLON.Axis.Y, 
            this.tmp_matrix
        );

        // 行列を反転し、クォータニオンを抽出、符号を固定（反転防止）
        this.tmp_matrix.invert();
        BABYLON.Quaternion.FromRotationMatrixToRef(this.tmp_matrix, this.tmp_targetQuaternion);
/*
        if (BABYLON.Quaternion.Dot(this.root.rotationQuaternion, this.tmp_targetQuaternion) < 0) {
            this.tmp_targetQuaternion.scaleInPlace(-1);
        }
*/
        // 球面線形補間
        let t = Math.min((this.rotate_speed * delta) / 1000, 1.0);
        BABYLON.Quaternion.SlerpToRef(
            this.root.rotationQuaternion,
            this.tmp_targetQuaternion,
            t,
            this.root.rotationQuaternion
        );
    }


    set_dying(){
        this.isCollidable = false;
        this.control_velocity.copyFrom(GLOBALS.ZERO_VECTOR);
        this.external_velocity.copyFrom(GLOBALS.ZERO_VECTOR);
        super.set_dying();
    }

    update(time, delta){

        if (!this.dying){
            // 外部速度の制限
            if (this.velocity.length() > GLOBALS.COLLIDABLE.MAX_EXTERNAL_VELOCITY){
                this.velocity.normalize();
                this.velocity.scaleInPlace(GLOBALS.COLLIDABLE.MAX_EXTERNAL_VELOCITY);
            }

            this.velocity.copyFrom(this.control_velocity);
            // this.velocity.scaleInPlace(control_ratio);
            this.velocity.addInPlace(this.external_velocity);
            // this.velocity.addInPlace(this.repulse_velocity);
            this.velocity.addInPlace(this.environment_velocity);

            // FPS補正
            this.velocity.scaleInPlace(Math.min(delta, GLOBALS.DELTA_CLAMP) / GLOBALS.DELTA);

            // 移動の実行
            this.root.position.addInPlace(this.velocity);

            // 外部からの速度の減衰
            this.external_velocity.scaleInPlace(GLOBALS.COLLIDABLE.EXTERNAL_VELOCITY_DAMPING);
            // this.repulse_velocity.scaleInPlace(this.repulse_velocity_damping);

            // ◆連続衝突の一時回避
            if (this.collision_disabled_timer > 0){
                this.collision_disabled_timer -= delta / 1000;
                if (this.collision_disabled_timer < 0){
                    this.isCollidable = this.isCollidable || this.isCollidable_save;
                    // console.log("[COL] COLLIDABLE Recover", this.isCollidable);
                }
            } else {
                if (this.collided){
                    this.collided = false;
                    this.collision_counter += 2;
                    if (this.collision_counter > 10){
                        // console.log("[COL] TOO MANY COLLISIONS", this.isCollidable);
                        this.collision_disabled_timer = COLLISION_DISABLED_PERIOD;
                        this.isCollidable_save = this.isCollidable;
                        this.isCollidable = false;
                    }
                } else {
                    this.collision_counter = Math.max(0, this.collision_counter -1);
                }
            }
        }

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

/*
// ◆振動の解決クラス
class OscillationResolver {
    constructor(collidable){
        this.collidable = collidable;
        this.collision_count = 0;
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
*/