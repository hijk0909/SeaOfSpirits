// spirit_1.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { MyDraw } from "../utils/DrawUtils.js";

const BOIDS_INTERVAL = 2;  // [適正値] 2

// 魚
export class Spirit_Fish extends Spirit {

    constructor(scene, class_name, generation){
        super(scene, class_name, generation);

        // クラス遺伝子
        this.genome.hp_max = 30;
        this.genome.hp_decrease = 0.01;
        this.genome.collision_radius = 0.30;
        this.genome.mass = 1.0;
        this.genome.speed = 0.06;
        this.genome.accel = 0.11;
        this.genome.rotate_speed = 3.0;
        this.genome.disp_scale = 1.0;
        this.genome.predation_classes = ["Spirit_Plankton"];
        this.genome.predation_socket = {front : 0.0, theta : 0.0 , phi : 0.0};
        this.genome.predation_radius = 1.2;

        // クラス固有のパラメータ
        this.perceptionRadius = 4.0;
        this.separationRadius = 3.0;
        this.base_color = new BABYLON.Color3();
        this.base_color_2 = new BABYLON.Color3();
        this.boids_counter = 0;

        // テンポラリ変数
        this.tmpSeparation = new BABYLON.Vector3();
        this.tmpAlignment = new BABYLON.Vector3();
        this.tmpCohesion = new BABYLON.Vector3();
        this.tmpAccel = new BABYLON.Vector3();
        this.tmpVec = new BABYLON.Vector3();
        this.tmpOffset = new BABYLON.Vector3();
        this.tmpDiff = new BABYLON.Vector3();
        this.tmp_matrix = new BABYLON.Matrix();
        this.tmp_deltaQuaternion = new BABYLON.Quaternion();
    }

    create(genome_modifier){
        const speed_ratio = genome_modifier?.speed ?? 1.0;
        this.base_color.copyFrom(MyDraw.saturatedColor(speed_ratio));
        this.base_color_2.copyFromFloats(1.0, 1.0, 0.0);

        super.create(genome_modifier);
    }

    _set_shared_materials(){
        let mat;

        mat = new BABYLON.PBRMaterial("eye", this.scene);
        mat.albedoColor = new BABYLON.Color3(0.4, 0.8, 1.0);
        mat.emissiveColor =  new BABYLON.Color3(3.0, 5.0, 1.0);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("eye", mat);

        mat = new BABYLON.PBRMaterial("tentacle", this.scene);
        mat.albedoColor = new BABYLON.Color3(1.0, 1.0, 0.0);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("tentacle", mat);

        mat = new BABYLON.PBRMaterial("spine", this.scene);
        mat.albedoColor.copyFrom(this.base_color);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("spine", mat);

        mat = new BABYLON.PBRMaterial("tail", this.scene);
        mat.albedoColor = new BABYLON.Color3(1.0, 0.0, 0.0);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("tail", mat);

        mat = null;

        this.remain_color.copyFrom(this.base_color);
    }

    _create_body(){
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "body", { diameter: 1.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        this.transform_to_streamline(this.mesh);

        const mat = new BABYLON.PBRMaterial("material", this.scene); 

        const speed_ratio = this.genome_modifier?.speed ?? 1.0;
        if (speed_ratio > 1.0){
            mat.albedoTexture = this.get_stripe_texture(this.base_color, this.base_color_2,10,1);
        } else {
            mat.albedoColor.copyFrom(this.base_color);
        }

        mat.metallic = 0.5;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        // mat.fillMode = BABYLON.Material.WireFrameFillMode;
        // mat.unlit = true;

        this.mesh.material = mat;
    }

    _set_attachment_definitions(){

        let def;

        const tentacle_length = 0.20 * this.genome_modifier.speed;
        def = {
            name: "Attachment_Tentacle",
            socket: {front:-0.1, thetaDeg:90, phiDeg:0},
            params: {segmentCont : 4, segmentLength : tentacle_length, offset : -0.1, material_key : "tentacle"}
        };
        this.attachment_definitions.push(structuredClone(def));
        def.socket.thetaDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Spine",
            socket: {front:-0.2, thetaDeg:-45, phiDeg: +90},
            params: {diameterBottom : 0.2, height :0.45, material_key : "spine"}
        };
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def ={
            name: "Attachment_Tail",
            socket: {front:0.0, thetaDeg:15, phiDeg: 180},
            params:  {scale : 1.0, material_key : "tail"}
        };
        this.attachment_definitions.push(structuredClone(def));

        def ={
            name: "Attachment_Eye",
            socket: {front:0.3, thetaDeg:45, phiDeg: -90},
            params:  {scale : 1.0, material_key : "eye"}
        };
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));
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

    activate(pos){
        super.activate(pos);
    }

    deactivate(){
        super.deactivate();
    }

    update(time, delta){

        this.boids_counter++;
        if (this.boids_counter > BOIDS_INTERVAL){
            this.boids_counter = 0;

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

            this.tmpAccel.scaleInPlace(this.genome.accel); //加速度の調整
            this.control_velocity.addInPlace(this.tmpAccel);

            if (this.control_velocity.length() > this.genome.speed){
                this.control_velocity = this.control_velocity.normalize()
                this.control_velocity.scaleInPlace(this.genome.speed);
            }
        }

        this.look_at(this.control_velocity, delta);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}