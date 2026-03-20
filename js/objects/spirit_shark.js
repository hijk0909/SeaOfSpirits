// spirit_shark.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { Attachment_Mouth} from "./attachment_mouth.js";
import { Attachment_Tail} from "./attachment_tail.js";
import { Attachment_Fin} from "./attachment_fin.js";
import { Attachment_Eye} from "./attachment_eye.js";

// サメ
export class Spirit_Shark extends Spirit {
    constructor(scene, class_name, id){    
        super(scene, class_name, id);

        this.disp_scale = 1.0;
        this.collisionRadius = 1.0;
        this.isCollidable = true;
        this.mass = 2.5;

        this.hp_max = 200;
        this.hp = this.hp_max;
        this.hp_decrease = 0.08;

        this.rotate_speed = 1.3;

        this.counter = 0;
        this.accel = 0;
        this.target = new BABYLON.Vector3();
        this.tmp_target = new BABYLON.Vector3();
        this.tmp_accel = new BABYLON.Vector3();
    }

    create(type=null){
       //  this.root.position = position.clone();

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
        let socket;
        let attachment;

        // ****************************************************
        socket = this.get_socket(this.mesh, 0.0, -5, 0);
        if (socket){
            attachment = new Attachment_Mouth(this, socket, {hasTeeth : true, biteSpeed : 3.0});
            this.attachments.push(attachment);

            this.predation_socket = socket;
            this.predation_radius = 1.2;
            this.predation_classes = ["Spirit_Fish"];
        }

        socket = this.get_socket(this.mesh, 0.0, 15, 180);
        if (socket){
            attachment = new Attachment_Tail(this, socket, {scale : 1.0});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, 0.0, +60, 0);
        if (socket){
            attachment = new Attachment_Fin(this, socket, {bottomScale : 2.0, height : 3.5});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, 0.0, -70, 0);
        if (socket){
            attachment = new Attachment_Fin(this, socket, {bottomScale : 2.0, height : 3.0});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, -0.5, +40, 180);
        if (socket){
            attachment = new Attachment_Fin(this, socket, {bottomScale : 1.0, height : 2.0});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, -0.8, -55, 180);
        if (socket){
            attachment = new Attachment_Fin(this, socket, {bottomScale : 1.0, height : 2.0});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, 0.7, 45, -90);
        if (socket){
            attachment = new Attachment_Eye(this, socket, {scale : 1.0});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, 0.7, 45, +90);
        if (socket){
            attachment = new Attachment_Eye(this, socket, {scale : 1.0});
            this.attachments.push(attachment);
        }

        // ****************************************************
        // 子meshを全てくっつけてから表示用の大きさを調整
        this.mesh.scaling = new BABYLON.Vector3(this.disp_scale, this.disp_scale, this.disp_scale);

        super.create(type);
    }

    activate(pos){
        super.activate(pos);
    }

    deactivate(){
        super.deactivate();
    }

    update(time, delta){

        this.counter -= delta / 1000;
        if (this.counter < 0){
            this.counter = 1.0 + 1.0 * Math.random();

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
                this.target.copyFrom(this.tmp_target);
                this.accel = 0.2;
            } else {
                this.target = new BABYLON.Vector3(Math.random()*6 -3, Math.random()*6 -3, Math.random()*6 -3);
                this.accel = 0.001;
            }

            this.target.subtractToRef(this.root.position, this.tmp_accel);
            this.tmp_accel.normalizeToRef(this.tmp_accel);
            this.tmp_accel.scaleInPlace(this.accel);
            this.control_velocity.copyFrom(this.tmp_accel);
        }

        this.control_velocity.scaleInPlace(0.98);

        this.rotate_to(this.control_velocity, delta);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }

}