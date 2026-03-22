// spirit_whale.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { Attachment_Mouth} from "./attachment_mouth.js";
import { Attachment_Eye} from "./attachment_eye.js";
import { Attachment_Tail} from "./attachment_tail.js";
import { Attachment_Spine} from "./attachment_spine.js";

// クジラ
export class Spirit_Whale extends Spirit {
    constructor(scene, class_name, type_name){    
        super(scene, class_name, type_name);

        this.disp_scale = 1.5;
        this.collisionRadius = 2.8;
        this.isCollidable = true;
        this.mass = 6.0;

        this.base_alpha = 0.5;
        this.base_color = new BABYLON.Color3(0.3, 0.82, 1.0);

        this.hp_max = 200;
        this.hp = this.hp_max;
        this.hp_decrease = 0.05;

        this.rotate_speed = 0.2;

        this.counter = 0;
        this.tmp_target = new BABYLON.Vector3();
        this.tmp_accel = new BABYLON.Vector3();
    }

    create(params){

        // ◆ボディの作成
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

        this.mesh.computeWorldMatrix(true);

        // ◆捕食口の設定
        this.predation_classes = ["Spirit_Plankton"];
        const predation_socket = this.get_socket(this.mesh, 0.0, -5, 0);
        this.predation_position = predation_socket.position;
        this.predation_radius = 2.0;

        super.create(params);
    }

    _set_attachment_definitions(){

        let def;

        def = {
            name: "Attachment_Mouth",
            socket: {front:0.0, thetaDeg:-5, phiDeg:0},
            params: {hasTeeth :false, biteSpeed : 1.0, alpha : this.base_alpha, color : this.base_color}
        };
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Tail",
            socket: {front:0.0, thetaDeg:-15, phiDeg:180},
            params: {scale : 3.0, twist : true, alpha : this.base_alpha, color : this.base_color}
        };
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Eye",
            socket: {front:0.5, thetaDeg:25, phiDeg:-45},
            params: {scale : 1.5, alpha : this.base_alpha}
        };
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Fin",
            socket: {front:0.1, thetaDeg:-45, phiDeg:+90},
            params: {bottomScale : 1.0, height : 2.0, alpha : this.base_alpha, color : this.base_color}
        }
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Spine",
            socket: {front:0.4, thetaDeg:+90, phiDeg:0},
            params: {diameterBottom : 0.5, height :1.5, alpha : this.base_alpha, color : this.base_color}
        };
        this.attachment_definitions.push(structuredClone(def));
    }

    activate(pos, params){
        super.activate(pos, params);
    }

    deactivate(){
        super.deactivate();
    }

    update(time, delta){

        this.counter -= delta / 1000;
        if (this.counter < 0){
            let count = 0;
            this.tmp_target.set(0,0,0);
            for (let spirit of GameState.spirits){
                if (this.predation_classes.includes(spirit.class_name)){
                    count++;
                    this.tmp_target.addInPlace(spirit.root.position);
                }
            }
            if (count > 0){
                this.tmp_target.scaleInPlace(1/count);
                this.target = this.tmp_target;
            } else {
                this.target = new BABYLON.Vector3(Math.random()*10 -5, Math.random()*10 -5, Math.random()*10);
            }

            this.counter = 4 + 4 * Math.random();
        }

        this.target.subtractToRef(this.root.position, this.tmp_accel);
        this.tmp_accel.normalize();
        this.tmp_accel.scaleInPlace(0.0003);
        this.control_velocity.addInPlace(this.tmp_accel);
        this.control_velocity.scaleInPlace(0.98);

        this.rotate_to(this.control_velocity, delta);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }

}