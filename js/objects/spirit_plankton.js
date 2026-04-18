// spirit_plankton.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { MyDraw } from "../utils/DrawUtils.js";

// プランクトン
export class Spirit_Plankton extends Spirit {

    constructor(scene, class_name, generation){
        super(scene, class_name, generation);

        // クラス遺伝子
        this.genome.hp_max = 10;
        this.genome.hp_decrease = 0.0;
        this.genome.is_collidable = false;
        this.genome.collision_radius = 0.20;
        this.genome.mass = 0.5;

        // クラス固有のパラメータ
        this.base_color = new BABYLON.Color4();
        this.index = null;
        this.tmp_scale = new BABYLON.Vector3();
        this.tmp_position = new BABYLON.Vector3();
    }

    create(genome_modifier){

        const h = (0.42 - this.generation * 0.02 + 1.0) % 1.0;
        const c = MyDraw.hsvToColor3(h, 1.0, 1.0);
        this.base_color.copyFromFloats(c.r, c.g, c.b, 1.0);

        super.create(genome_modifier);

        this.genome.speed = 0.05;         // プランクトンは動かない。比較基準として 0.05 固定。
        // [TEST]
        this.genome.hp_max = 10 + this.generation * 5;
        this.genome.disp_scale = Math.min(1.0, 0.4 + this.generation * 0.1);
        const s = this.genome.disp_scale;
        this.tmp_scale.copyFromFloats(s,s,s);
    }

    _set_shared_materials(){
        this.remain_color.copyFrom(this.base_color);
    }

    _create_body(){
    }

    _set_attachment_definitions(){
    }

    activate(pos){
        super.activate(pos);
        this.base_color.a = 1.0;
        this.index = GameState.thinManager_plankton.register_instance();
        // console.log("spirit_plankton index=", this.index);
        if (this.index === null){
            this.alive = false;
        } else {
            GameState.thinManager_plankton.set_matrix(this.index, this.tmp_scale, this.root.position);
            GameState.thinManager_plankton.set_color(this.index, this.base_color);
        }
    }

    deactivate(){
        if (this.index !== null){
            GameState.thinManager_plankton.unregister_instance(this.index);
            this.index = null;
        }
        super.deactivate();
    }

    // ゴールデンスパイラル（Fibonacci spiral on sphere）で球面上の点を均等に配置
    // theta:極角（緯度） phi:方位角（経度）
    get_golden_spiral_angles(N, i) {
        const goldenRatio = (1 + Math.sqrt(5)) / 2;  // ≈ 1.6180339887

        // 極角 theta（+Z軸からの角度、北極が0°、南極が180°）
        const thetaRad = Math.acos(1 - 2 * (i + 0.5) / N);
        const thetaDeg = thetaRad * (180 / Math.PI);

        // 方位角 phi（黄金比による均等分布）
        const phiRad = 2 * Math.PI * i / goldenRatio;
        let phiDeg = phiRad * (180 / Math.PI);

        // 0〜360° の範囲に正規化
        phiDeg = phiDeg % 360;
        if (phiDeg < 0) phiDeg += 360;

        return { theta: thetaDeg, phi: phiDeg };
    }

    update(time, delta){
        if (this.root.position.length() > 4.0){
            this.tmp_position.copyFrom(this.root.position);
            this.tmp_position.scaleInPlace(-0.001);
            this.control_velocity.copyFrom(this.tmp_position);
        }
        this.control_velocity.scaleInPlace(0.98);
        super.update(time, delta);

        GameState.thinManager_plankton.set_position(this.index, this.root.position);
        if (this.dying){
            this.base_color.a = this.dying_ratio;
            GameState.thinManager_plankton.set_color(this.index, this.base_color);
        }
    }

    dispose(){
        if (this.index !== null){
            GameState.thinManager_plankton.unregister_instance(this.index);
            this.index = null;
        }
        super.dispose();
    }
}