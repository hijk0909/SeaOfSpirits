// spirit_jelly.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { MyMath } from "../utils/MathUtils.js";

// クラゲ
export class Spirit_Jelly extends Spirit {

    constructor(scene, class_name, generation){
        super(scene, class_name, generation);

        // クラス遺伝子
        this.genome.hp_max = 80;
        this.genome.hp_decrease = 0.026;
        this.genome.disp_scale = 0.90;
        this.genome_collision_radius = 0.15;
        this.genome_is_collidable = true;
        this.genome.mass = 1.0;
        this.genome.speed = 0.05;
        this.genome.predation_classes = ["Spirit_Plankton"];
        this.genome.predation_socket = {front : 0.0, theta : 0.0 , phi : 0.0};
        this.genome.predation_radius = 0.5;

        // クラス固有のパラメータ
        this.counter = 0;
        this.texture_color_1 = new BABYLON.Color3();
        this.texture_color_2 = new BABYLON.Color3();
        this.target = new BABYLON.Vector3(0,0,0);
    }

    create(genome_modifier){

        const speed_ratio = genome_modifier?.speed ?? 1.0;
        if (speed_ratio > 1.0){
            if (this.generation >= 2){
                this.texture_color_1.copyFromFloats(1.0, 0.0, 0.0);
                this.texture_color_2.copyFromFloats(1.0, 0.8, 0.3);
            } else {
                this.texture_color_1.copyFromFloats(0.3, 0.6, 0.3);
                this.texture_color_2.copyFromFloats(1.0, 1.0, 1.0);
            }
        } else {
            this.texture_color_1.copyFromFloats(0.0, 0.5, 1.0);
            this.texture_color_2.copyFromFloats(1.0, 1.0, 1.0);
        }

        super.create(genome_modifier);
    }

    _create_body(){
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "spirit_2_body", { diameter: 1.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        this.transform_to_jelly(this.mesh);

        const mat = new BABYLON.PBRMaterial("spirit_2_material", this.scene); 
        // mat.albedoColor.copyFrom(this.base_color);
        mat.albedoTexture = this.get_spot_texture(this.texture_color_1, this.texture_color_2, 30);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        this.mesh.material = mat;
    }

    _set_attachment_definitions(genome){

        let def;

        def = {
            name: "Attachment_Tentacle",
            params: {segmentCont : 4, length : 0.30, thicknessBase : 0.2, thicknessTip : 0.06}
        };
        for (let i = 0; i < 360; i += 120){
            const {theta, phi} = MyMath.rotate_to_front(-30, i);
            def.socket = {front:0.0, thetaDeg:theta, phiDeg: phi};
            this.attachment_definitions.push(structuredClone(def));
        }

        def = {
            name: "Attachment_Spine",
            params: {diameterBottom : 0.15, height :0.24}
        };
        for (let i = 0; i < 360; i += 90){
            const {theta, phi} = MyMath.rotate_to_front(+60, i);
            def.socket = {front:0.0, thetaDeg:theta, phiDeg: phi};
            this.attachment_definitions.push(structuredClone(def));
        }

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
            this.control_velocity = this.target.subtract(this.root.position);
            this.control_velocity.normalize();
            this.control_velocity.scaleInPlace(this.genome.speed);
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