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
    constructor(scene, class_name, id){    
        super(scene, class_name, id);

        this.disp_scale = 1.5;
        this.collisionRadius = 2.8;
        this.isCollidable = true;
        this.mass = 6.0;

        this.base_alpha = 0.5;

        this.hp_max = 200;
        this.hp = this.hp_max;
        this.hp_decrease = 0.05;

        this.counter = 0;
        this.tmp_target = new BABYLON.Vector3();
        this.tmp_accel = new BABYLON.Vector3();
    }

    create(type=null){
        // this.root.position = position.clone();
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "body", { diameterZ: 4.0, diameterX: 3.0, diameterY: 3.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        const mat = new BABYLON.PBRMaterial("material", this.scene); 
        mat.albedoColor = new BABYLON.Color3(0.2, 0.5, 0.8);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = this.base_alpha;
        this.mesh.material = mat;

        this.mesh.computeWorldMatrix(true);
        let socket;
        let attachment;

        // ****************************************************
        socket = this.get_socket(this.mesh, 0.0, -5, 0);
        if (socket){
            attachment = new Attachment_Mouth(this, socket, {hasTeeth : false, biteSpeed : 1.0, alpha : this.base_alpha});
            this.attachments.push(attachment);

            this.predation_socket = socket;
            this.predation_radius = 5.0;
            this.predation_classes = ["Spirit_Plankton"];
        }

        socket = this.get_socket(this.mesh, 0.0, -15, 180);
        if (socket){
            attachment = new Attachment_Tail(this, socket, {scale : 3.0, twist : true, alpha : this.base_alpha});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, 0.5, 25, -45);
        if (socket){
            attachment = new Attachment_Eye(this, socket, {scale : 1.0, alpha : this.base_alpha});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, 0.5, 25, +45);
        if (socket){
            attachment = new Attachment_Eye(this, socket, {scale : 1.0, alpha : this.base_alpha});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, 0.1, -45, +90);
        if (socket){
            attachment = new Attachment_Spine(this, socket, {diameterBottom : 1.0, height :2.0, alpha : this.base_alpha});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, 0.1, -45, -90);
        if (socket){
            attachment = new Attachment_Spine(this, socket, {diameterBottom : 1.0, height :2.0, alpha : this.base_alpha});
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
                this.target = new BABYLON.Vector3(Math.random()*10 -5, Math.random()*10 -5, Math.random()*10 -5);
            }

            this.counter = 4 + 4 * Math.random();
        }

        this.target.subtractToRef(this.root.position, this.tmp_accel);
        this.tmp_accel.normalizeToRef(this.tmp_accel);
        this.tmp_accel.scaleInPlace(0.0005);
        this.control_velocity.addInPlace(this.tmp_accel);
        this.control_velocity.scaleInPlace(0.98);

        this.rotate_to(this.control_velocity, delta);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }

}