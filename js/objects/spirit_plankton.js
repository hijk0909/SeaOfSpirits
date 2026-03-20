// spirit_plankton.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { Attachment_Spine} from "./attachment_spine.js";

// プランクトン
export class Spirit_Plankton extends Spirit {

    constructor(scene, class_name, id){
        super(scene, class_name, id);

        this.disp_scale = 0.4;
        this.collisionRadius = 0.20;
        this.isCollidable = false;
        this.mass = 0.5;

        this.hp_max = Math.random() * 100 + 50;
        this.hp = this.hp_max;
        this.hp_decrease = 0.0;

        this.num_spines = 13;
    }

    create(type=null){

        // this.root.position = position.clone();

        this.mesh = BABYLON.MeshBuilder.CreateSphere( "body", { diameter: 0.5, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        const mat = new BABYLON.PBRMaterial("material", this.scene); 
        mat.albedoColor = new BABYLON.Color3(0.0, 1.0, 0.0);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.mesh.material = mat;

        this.mesh.computeWorldMatrix(true);
        let socket;
        let attachment;

        // ****************************************************

        for ( let i = 0 ; i < this.num_spines ; i++){
            const {theta, phi} = this.get_golden_spiral_angles(this.num_spines, i);
            socket = this.get_socket(this.mesh, 0.0, phi, theta);
            if (socket){
                attachment = new Attachment_Spine(this, socket, {diameterBottom : 0.1, height: 0.15});
                this.attachments.push(attachment);                
            }
        }

        // ****************************************************
        // 子meshを全てくっつけてから表示用の大きさを調整
        this.mesh.scaling = new BABYLON.Vector3(this.disp_scale, this.disp_scale, this.disp_scale);

        super.create(type);

        // console.log("Spirit_1:this.root.position", this.id, this.root.position, this.mesh.position);
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
        if (this.root.position.length() > 5.0){
            this.control_velocity = this.root.position.scale(-0.001);
        }
        this.control_velocity.scaleInPlace(0.98);
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}