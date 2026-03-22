// spirit_shark.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";

// サメ
export class Spirit_Shark extends Spirit {
    constructor(scene, class_name, type_name){    
        super(scene, class_name, type_name);

        this.disp_scale = 1.0;
        this.collisionRadius = 1.0;
        this.isCollidable = true;
        this.mass = 2.5;

        this.hp_max = 200;
        this.hp = this.hp_max;
        this.hp_decrease = 0.08;

        this.rotate_speed = 1.3;


        this.maxSpeed = 0.1;
        this.maxForce = 0.01;
        this.slowRadius = 3;
        this.tmp_target = new BABYLON.Vector3();
        this.tmp_toTarget = new BABYLON.Vector3();
        this.tmp_desiredVelocity = new BABYLON.Vector3();
        this.tmp_steering = new BABYLON.Vector3();
    }

    create(params){

        // ◆ボディの作成
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "body", { diameterZ: 3.5, diameterX: 1.5, diameterY: 2.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        const mat = new BABYLON.PBRMaterial("material", this.scene); 
        mat.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.8);
        mat.metallic = 0.8;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.mesh.material = mat;

        this.mesh.computeWorldMatrix(true);

        // ◆捕食口の設定
        this.predation_classes = ["Spirit_Fish"];
        const predation_socket = this.get_socket(this.mesh, 0.0, -5, 0);
        this.predation_position = predation_socket.position;
        this.predation_radius = 1.2;

        super.create(params);
    }

    _set_attachment_definitions(){

        let def;

        def = {
            name: "Attachment_Mouth",
            socket: {front:0.0, thetaDeg:-5, phiDeg:0},
            params: {hasTeeth : true, biteSpeed : 3.0}
        };
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Tail",
            socket: {front:0.0, thetaDeg:15, phiDeg:180},
            params: {scale : 1.0}
        };
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Fin",
            socket: {front:0.0, thetaDeg:+75, phiDeg:0},
            params: {bottomScale : 2.0, height : 2.0}
        }
        this.attachment_definitions.push(structuredClone(def));

        def.socket = {front:0.0, thetaDeg:-55, phiDeg:0};
        def.params = {bottomScale : 2.0, height : 2.5};
        this.attachment_definitions.push(structuredClone(def));

        def.socket = {front:-0.5, thetaDeg:+40, phiDeg: 180};
        def.params = {bottomScale : 1.0, height : 1.5};
        this.attachment_definitions.push(structuredClone(def));

        def.socket = {front:-0.8, thetaDeg:-55, phiDeg: 180};
        def.params = {bottomScale : 1.0, height : 1.5};
        this.attachment_definitions.push(structuredClone(def));
        
        def = {
            name: "Attachment_Eye",
            socket: {front:0.7, thetaDeg:+45, phiDeg:-90},
            params: {scale : 1.0}
        }
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));
    }

    activate(pos, params){
        super.activate(pos, params);
    }

    deactivate(){
        super.deactivate();
    }

    update(time, delta){

        // ターゲット位置（魚群の重心）
        this.tmp_target.set(0,0,0);

        let target_count = 0;
        for (let spirit of GameState.spirits){
            if (this.predation_classes.includes(spirit.class_name)){
                target_count++;
                this.tmp_target.addInPlace(spirit.root.position);
            }
        }
        if (target_count > 0){
            this.tmp_target.scaleInPlace(1/target_count);
        } else {
            this.tmp_target = new BABYLON.Vector3(Math.random()*6 -3, Math.random()*6 -3, Math.random()*6 -3);
        }

        // ターゲットに向かう速度計算
        this.tmp_target.subtractToRef(this.root.position, this.tmp_toTarget);
        const distance = this.tmp_toTarget.length();
 
        let desiredSpeed = this.maxSpeed;
        if (distance < this.slowRadius) {
            desiredSpeed *= distance / this.slowRadius;
        }
        this.tmp_toTarget.normalizeToRef(this.tmp_desiredVelocity);
        this.tmp_desiredVelocity.scaleInPlace(desiredSpeed);
        this.tmp_desiredVelocity.subtractToRef(this.control_velocity, this.tmp_steering);
        
        // 加速度制限
        if (this.tmp_steering.length() > this.maxForce) {
            this.tmp_steering.normalize();
            this.tmp_steering.scaleInPlace(this.maxForce);
        }
        this.control_velocity.addInPlace(this.tmp_steering);

        this.rotate_to(this.control_velocity, delta);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }

}