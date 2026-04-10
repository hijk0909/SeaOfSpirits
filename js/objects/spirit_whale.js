// spirit_whale.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { MyDraw } from "../utils/DrawUtils.js";

// クジラ
export class Spirit_Whale extends Spirit {
    constructor(scene, class_name, generation){    
        super(scene, class_name, generation);

        // クラス遺伝子
        this.genome.hp_max = 600;
        this.genome.hp_decrease = 0.01;
        this.genome.disp_scale = 2.0;
        this.genome.collision_radius = 3.0;
        this.genome.is_collidable = true;
        this.genome.mass = 8.0;
        this.genome.speed = 0.04;
        this.genome.accel = 0.2;
        this.genome.rotate_speed = 2.5;
        this.genome.predation_classes = ["Spirit_Plankton"];
        this.genome.predation_socket = {front : 0.0, theta : -5.0 , phi : 0.0};
        this.genome.predation_radius = 4.0;

        // クラス固有の設定      
        this.base_alpha = 0.5;
        this.base_color = new BABYLON.Color3(0.3, 0.82, 1.0);

        // 運動用変数
        this.life_time = 0;
        this.roaming_center = new BABYLON.Vector3(0, 0, 5.0); //周回中心
        this.roaming_radius = 7.0; //周回半径
        this.tmp_toObject = new BABYLON.Vector3();
        this.tmp_accel = new BABYLON.Vector3();
    }

    create(genome_modifier) {
        const speed_ratio = genome_modifier?.speed ?? 1.0;
        this.base_color.copyFrom(MyDraw.saturatedColor(speed_ratio));
        super.create(genome_modifier);
        this.setupDepthClone();
    }

    _set_shared_materials(){
        let mat;

        mat = new BABYLON.PBRMaterial("eye", this.scene);
        mat.albedoColor = new BABYLON.Color3(0.8, 1.0, 1.0);
        mat.emissiveColor = new BABYLON.Color3(0.8, 3.0, 3.0);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = this.base_alpha;
        this.shared_materials.set("eye", mat);

        mat = new BABYLON.PBRMaterial("parts", this.scene);
        mat.albedoColor = this.base_color;
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = this.base_alpha;
        this.shared_materials.set("parts", mat);

        mat = null;
    }

    _create_body(){
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "body", { diameterZ: 4.0, diameterX: 3.0, diameterY: 3.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        const mat = new BABYLON.PBRMaterial("material", this.scene); 
        mat.albedoColor = this.base_color;
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = this.base_alpha;
        this.mesh.material = mat;
    }

    _set_attachment_definitions(){

        let def;

        def = {
            name: "Attachment_Mouth",
            socket: {front:0.0, thetaDeg:-5, phiDeg:0},
            params: {hasTeeth :false, biteSpeed : 1.0, lip_material_key : "parts"}
        };
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Tail",
            socket: {front:0.0, thetaDeg:-5, phiDeg:180},
            params: {scale : 3.0, twist : true, speed : 3.0, material_key : "parts"}
        };
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Eye",
            socket: {front:0.5, thetaDeg:25, phiDeg:-45},
            params: {scale : 1.5, material_key : "eye"}
        };
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Fin",
            socket: {front:0.1, thetaDeg:-45, phiDeg:+90},
            params: {bottomScale : 1.0, height : 2.0, twist : 90, material_key : "parts"}
        }
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Spine",
            socket: {front:0.4, thetaDeg:+60, phiDeg:0},
            params: {diameterBottom : 0.5, height :1.0, material_key : "parts"}
        };
        this.attachment_definitions.push(structuredClone(def));
    }

    activate(pos){
        super.activate(pos);
    }

    deactivate(){
        super.deactivate();
    }

    update(time, delta){

        this.life_time += delta;

        // 中心→対象の方向ベクトル（＝法線方向）
        this.root.position.subtractToRef(this.roaming_center, this.tmp_toObject);
        const currentRadius = this.tmp_toObject.length();
        if (currentRadius < 0.001) return;

        // 球面上に位置するように法線方向の力加減を計算
        this.tmp_toObject.normalize(); //法線方向の単位ベクトル
        const radiusError = currentRadius - this.roaming_radius; // 正:外側, 負:内側
        const vNormal = BABYLON.Vector3.Dot(this.control_velocity, this.tmp_toObject); // 現在速度の法線方向成分
        const kp = this.genome.accel;        // 中心方向へのバネ定数
        const kd = 2.0 * Math.sqrt(kp);      // 臨界減衰係数（ダンパー）
        const aNormalScalar = -kp * radiusError - kd * vNormal; // 法線方向の加速度（位置ずれを戻す + 法線速度を打ち消す）

        // 接平面方向の加速度
        const rotationAxis = this.tmp_toObject; //回転軸
        const steeringSpeed = Math.sin(this.life_time * 0.0001) * 0.005; //旋回角度
        const rotation = BABYLON.Quaternion.RotationAxis(rotationAxis, steeringSpeed);
        this.control_velocity.rotateByQuaternionToRef(rotation, this.control_velocity); //速度ベクトルの回転

        // 法線方向の加速度を加えてから正規化・定数倍
        this.tmp_accel.copyFrom(this.tmp_toObject).scaleInPlace(aNormalScalar);
        this.control_velocity.addInPlace(this.tmp_accel);
        this.control_velocity.normalize();
        this.control_velocity.scaleInPlace(this.genome.speed);

        this.rotate_to(this.control_velocity, delta);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }

}