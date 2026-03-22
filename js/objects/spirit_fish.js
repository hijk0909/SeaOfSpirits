// spirit_1.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";

// 魚
export class Spirit_Fish extends Spirit {

    constructor(scene, class_name, type_name){
        super(scene, class_name, type_name);

        this.disp_scale = 1.0;
        this.collisionRadius = 0.30;
        this.isCollidable = true;
        this.mass = 1.0;

        this.hp_max = 20;
        this.hp = this.hp_max;
        this.hp_decrease = 0.01;

        this.perceptionRadius = 4.0;
        this.separationRadius = 3.0;
        this.max_control_velocity = 0.12;

        // Boids計算用テンポラリ変数
        this.tmpSeparation = new BABYLON.Vector3();
        this.tmpAlignment = new BABYLON.Vector3();
        this.tmpCohesion = new BABYLON.Vector3();
        this.tmpAccel = new BABYLON.Vector3();
        this.tmpVec = new BABYLON.Vector3();
        this.tmpOffset = new BABYLON.Vector3();
        this.tmpDiff = new BABYLON.Vector3();
    }

    create(params){

        // ◆ボディの作成
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "body", { diameter: 1.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        this.transform_to_streamline(this.mesh);

        const mat = new BABYLON.PBRMaterial("material", this.scene); 
        mat.albedoColor = new BABYLON.Color3(1, 0.5, 0.3);
        mat.metallic = 0.2;
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
            name: "Attachment_Tentacle",
            socket: {front:-0.1, thetaDeg:90, phiDeg:0},
            params: {segmentCont : 4, length : 0.25}
        };
        this.attachment_definitions.push(structuredClone(def));
        def.socket.thetaDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Spine",
            socket: {front:-0.2, thetaDeg:-45, phiDeg: +90},
            params: {diameterBottom : 0.2, height :0.45}
        };
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def ={
            name: "Attachment_Tail",
            socket: {front:0.0, thetaDeg:15, phiDeg: 180},
            params:  {scale : 1.0}
        };
        this.attachment_definitions.push(structuredClone(def));

        def ={
            name: "Attachment_Eye",
            socket: {front:0.3, thetaDeg:45, phiDeg: -90},
            params:  {scale : 1.0}
        };
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

    transform_to_streamline(mesh){
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        for (let i = 0; i < positions.length; i += 3) {
            let x = positions[i];
            let y = positions[i+1];
            let z = positions[i+2];
            // 前方を細くする
            const taper = 1 - 0.5 * (z + 0.5);
            positions[i] *= taper;
            positions[i+1] *= taper;
        }
        mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    }

    update(time, delta){
        // BOIDS
        this.tmpSeparation.copyFrom(GLOBALS.ZERO_VECTOR);
        this.tmpAlignment.copyFrom(GLOBALS.ZERO_VECTOR);
        this.tmpCohesion.copyFrom(GLOBALS.ZERO_VECTOR);
        this.tmpForward = this.get_forward_vector();
        
        let count = 0;

        for (let other of GameState.spirits){
            if ( other === this ) continue;
            if ( other.class_name !== this.class_name) continue;
            const distSq = BABYLON.Vector3.DistanceSquared(other.root.position, this.root.position);
            if ( distSq > this.perceptionRadius * this.perceptionRadius) continue;

            // separation
            if( distSq < this.separationRadius * this.separationRadius){
                const dist = Math.sqrt(distSq);
                if (dist < 0.0001) continue;
                this.root.position.subtractToRef(other.root.position, this.tmpDiff);
                let t = (this.separationRadius - dist) / this.separationRadius;
                let strength = t * t;
                this.tmpDiff.normalize();
                this.tmpDiff.scaleInPlace(strength);
                this.tmpSeparation.addInPlace(this.tmpDiff);
            }

            other.root.position.subtractToRef(this.root.position, this.tmpOffset)
            this.tmpOffset.normalizeToRef(this.tmpVec);
            let dot = BABYLON.Vector3.Dot(this.tmpForward, this.tmpVec);
            if (dot < 0.3) continue;

            count++;
            // cohesion
            this.tmpCohesion.addInPlace(other.root.position);
            // alignment
            this.tmpAlignment.addInPlace(other.velocity);
        }

        if(count > 0){
            this.tmpCohesion.scaleInPlace(1/count);
            this.tmpCohesion.subtractInPlace(this.root.position);
            this.tmpAlignment.scaleInPlace(1/count);
        }

        // 速度の合成
        this.tmpAccel.copyFrom(this.tmpSeparation);
        this.tmpAccel.scaleInPlace(2.0); //群れから離れる

        this.tmpAlignment.scaleInPlace(0.3); //群れの速度に合わせる
        this.tmpAccel.addInPlace(this.tmpAlignment);

        this.tmpCohesion.scaleInPlace(0.008); // 群れの中止に向かう
        this.tmpAccel.addInPlace(this.tmpCohesion);

        this.tmpVec.copyFrom(this.root.position);
        this.tmpVec.scaleInPlace(-0.003); //グローバル座標の中心に向かう
        this.tmpAccel.addInPlace(this.tmpVec);

        this.tmpAccel.scaleInPlace(0.11); //加速度の調整
        this.control_velocity.addInPlace(this.tmpAccel);

        if (this.control_velocity.length() > this.max_control_velocity){
            this.control_velocity = this.control_velocity.normalize().scale(this.max_control_velocity);
        }

        this.rotate_to(this.control_velocity, delta);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}