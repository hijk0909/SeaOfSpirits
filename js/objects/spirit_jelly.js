// spirit_jelly.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { Attachment_Tentacle} from "./attachment_tentacle.js";

// クラゲ
export class Spirit_Jelly extends Spirit {

    constructor(scene, class_name, id){
        super(scene, class_name, id);

        this.disp_scale = 1.0;
        this.collisionRadius = 0.30;
        this.isCollidable = true;
        this.mass = 1.0;

        this.hp_max = 80;
        this.hp = this.hp_max;
        this.hp_decrease = 0.026;

        this.counter = 0;
        this.target = new BABYLON.Vector3(0,0,0);
    }

    create(type=null){

        // this.root.position = position.clone();

        this.mesh = BABYLON.MeshBuilder.CreateSphere( "spirit_2_body", { diameter: 1.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        this.transform_to_jelly(this.mesh);

        const mat = new BABYLON.PBRMaterial("spirit_2_material", this.scene); 
        mat.albedoColor = new BABYLON.Color3(0.0, 0.5, 1.0);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.mesh.material = mat;

        this.mesh.computeWorldMatrix(true);
        let socket;
        let attachment;

        // ****************************************************
        socket = this.get_socket(this.mesh, 0.0, 0, 0);
        if (socket){
            this.predation_socket = socket;
            this.predation_radius = 0.5;
            this.predation_classes = ["Spirit_Plankton"];
        }

        socket = this.get_socket(this.mesh, -0.00, 60, 180);
        if (socket){
            attachment = new Attachment_Tentacle(this, socket, {segmentCont : 4, length : 0.30, thicknessBase : 0.3, thicknessTip : 0.02});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, -0.00, -60, 180);
        if (socket){
            attachment = new Attachment_Tentacle(this, socket, {segmentCont : 4, length : 0.30, thicknessBase : 0.3, thicknessTip : 0.02});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, -0.00, 0, 120);
        if (socket){
            attachment = new Attachment_Tentacle(this, socket, {segmentCont : 4, length : 0.30, thicknessBase : 0.3, thicknessTip : 0.02});
            this.attachments.push(attachment);
        }

        socket = this.get_socket(this.mesh, -0.00, 0, -120);
        if (socket){
            attachment = new Attachment_Tentacle(this, socket, {segmentCont : 4, length : 0.30, thicknessBase : 0.3, thicknessTip : 0.02});
            this.attachments.push(attachment);
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

    transform_to_jelly(mesh) {
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

        for (let i = 0; i < positions.length; i += 3) {
            let x = positions[i];
            let y = positions[i+1];
            let z = positions[i+2];

            // 上半球（Z >= 0）: 0 → 0.4
            if (z >= 0) {
                const t = z / 1.0; // 球のZ=1を基準
                const zNew = 0.6 * Math.pow(t, 0.8); // 少しふっくら
                positions[i+2] = zNew;

                // 横方向も少し縮める（ふっくら感）
                const scale = 1.0 - 0.2 * t;
                positions[i] *= scale;
                positions[i+1] *= scale;
            }

            // 下半球（Z < 0）: -1 → -0.1 に強く押しつぶす
            else {
                const t = -z / 1.0; // 0〜1
                const zNew = -0.1 * Math.pow(t, 0.3); // ぺたんこ
                positions[i+2] = zNew;

                // 下側はほぼ円盤なので横方向はほぼそのまま
                const scale = 1.0 - 0.05 * t;
                positions[i] *= scale;
                positions[i+1] *= scale;
            }
        }

        mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    }


    update(time, delta){

        this.counter -= delta / 1000;
        if (this.counter < 0){
            this.target = new BABYLON.Vector3(Math.random()*6 -3, Math.random()*6 -3, Math.random()*6 -3);
            this.control_velocity = this.target.subtract(this.root.position).normalize().scale(0.1);
            this.counter = 3 + 3 * Math.random();
        }
        this.control_velocity.scaleInPlace(0.98);

        this.rotate_to(this.control_velocity, delta);

        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}