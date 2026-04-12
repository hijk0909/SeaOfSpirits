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
        this.genome.disp_scale = 0.4;
        this.genome.is_collidable = false;
        this.genome.collision_radius = 0.20;
        this.genome.mass = 0.5;

        // クラス固有のパラメータ
        this.base_color = new BABYLON.Color3();
        this.num_spines = 7;
    }

    create(genome_modifier){

        if (this.generation === 0){
            this.base_color.copyFromFloats(0.0, 1.0, 0.0);
            this.num_spines = 13;
        } else {
            this.base_color.copyFromFloats(0.8, 1.0, 0.4);
            this.num_spines = 19;
        }
        super.create(genome_modifier);

        // プランクトンは動かない。比較基準として 0.05 固定。
        this.genome.speed = 0.05;
    }

    _set_shared_materials(){
        let mat;

        mat = new BABYLON.PBRMaterial("spine", this.scene);
        mat.albedoColor = new BABYLON.Color3(0.0, 0.8, 0.0);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("spine", mat);

        mat = null;

        this.remain_color.copyFrom(this.base_color);
    }

    _create_body(){
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "body", { diameter: 0.5, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        const mat = new BABYLON.PBRMaterial("material", this.scene); 
        mat.albedoColor.copyFrom(this.base_color);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.mesh.material = mat;
    }

    _set_attachment_definitions(){
        let def = {
            name: "Attachment_Spine",
            params: {diameterBottom : 0.1, height: 0.15, material_key: "spine"}
        }
        for ( let i = 0 ; i < this.num_spines ; i++){
            const {theta, phi} = this.get_golden_spiral_angles(this.num_spines, i);
            def.socket = {front:0.0, thetaDeg : phi, phiDeg : theta};
            this.attachment_definitions.push(structuredClone(def));
        }
    }

    activate(pos){
        super.activate(pos);
    }

    deactivate(){
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
            this.control_velocity = this.root.position.scale(-0.001);
        }
        this.control_velocity.scaleInPlace(0.98);
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}