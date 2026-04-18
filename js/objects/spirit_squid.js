// spirit_squid.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { MyMath } from "../utils/MathUtils.js";
import { MyDraw } from "../utils/DrawUtils.js";

const STATE_ALIGNING = 0;
const STATE_COOLDOWN = 2;

// イカ
export class Spirit_Squid extends Spirit {

    constructor(scene, class_name, generation){
        super(scene, class_name, generation);

        // クラス遺伝子
        this.genome.hp_max = 120;
        this.genome.hp_decrease = 0.026;
        this.genome.disp_scale = 1.15;
        this.genome_collision_radius = 0.25;
        this.genome_is_collidable = true;
        this.genome.mass = 1.8;
        this.genome.speed = 0.2;
        this.genome.rotate_speed = 0.3;
        this.genome.predation_classes = ["Spirit_Plankton", "Spirit_Jelly", "Spirit_Fish"];
        this.genome.predation_socket = {front : 0.0, theta : 0.0 , phi : 0.0};
        this.genome.predation_radius = 1.0;

        // クラス固有のパラメータ
        this.state = STATE_COOLDOWN;
        this.state_counter = 0;
        this.aligning_speed = 0.01;
        this.base_color = new BABYLON.Color3(0.0, 0.5, 1.0);
        this.parts_color = new BABYLON.Color3(0.7, 1.0, 1.0);

        // テンポラリ変数
        this.tmp_target = new BABYLON.Vector3(0,0,0);
        this.tmp_toTarget = new BABYLON.Vector3();
        this.tmp_forward = new BABYLON.Vector3();
    }

    create(genome_modifier){
        const speed_ratio = genome_modifier?.speed ?? 1.0;
        this.parts_color.copyFrom(MyDraw.saturatedColor(speed_ratio));

        super.create(genome_modifier);
    }

    _set_shared_materials(){
        let mat;

        mat = new BABYLON.PBRMaterial("eye", this.scene);
        mat.albedoColor = new BABYLON.Color3(0.0, 1.0, 1.0);
        mat.emissiveColor =   new BABYLON.Color3(0.0, 3.0, 3.0);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("eye", mat);

        mat = new BABYLON.PBRMaterial("parts", this.scene);
        mat.albedoColor.copyFrom(this.parts_color);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("parts", mat);
/*
        mat = new BABYLON.PBRMaterial("tentacle", this.scene);
        mat.albedoColor.copyFrom(this.tentacle_color);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("tentacle", mat);
*/
        mat = null;

        this.remain_color.copyFrom(this.parts_color);
    }

    _create_body(){
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "spirit_squid_body", { diameter: 1.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        this.transform_to_squid(this.mesh);

        const mat = new BABYLON.PBRMaterial("spirit_squid_material", this.scene); 
        mat.albedoColor = this.base_color;
        mat.metallic = 0.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.mesh.material = mat;
    }

    _set_attachment_definitions(genome){

        let def;

        def = {
            name: "Attachment_Tentacle",
            params: {segmentCont : 3, segmentLength : 0.20, thicknessBase : 0.3, thicknessTip : 0.02, material_key : "parts"}
        };
        for (let i = 0; i < 360; i += 60){
            const {theta, phi} = MyMath.rotate_to_front(-45, i);
            def.socket = {front:0.0, thetaDeg:theta, phiDeg: phi};
            this.attachment_definitions.push(structuredClone(def));
        }

        def ={
            name: "Attachment_Eye",
            socket: {front:0.0, thetaDeg:+15, phiDeg: -90},
            params:  {scale : 1.0, material_key : "eye"}
        };
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Fin",
            socket: {front:+0.2, thetaDeg:0, phiDeg: +25},
            params: {bottomScale : 1.2, height : 0.8, twist : 90, material_key : "parts" }
        }
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

    }

    activate(pos){
        super.activate(pos);
    }

    deactivate(){
        super.deactivate();
    }

    transform_to_squid(mesh, params = {}){
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const {lengthFactor= 1.6, taperSharpness = 1.8, headWidth = 1.25, headFlatten = 0.25 } = params;

        for (let i = 0; i < positions.length; i += 3) {
            let x = positions[i];
            let y = positions[i + 1];
            let z = positions[i + 2];

            // 正規化されたt（球の半径を1.0基準とする）
            const radius = Math.sqrt(x * x + y * y + z * z) || 1.0;
            const normalizedZ = z / radius;  // -1.0 〜 +1.0

            if (normalizedZ >= 0) {
                // +Z側（マントル後方）：細長くシャープに伸ばす（jet propulsionのイメージ）
                const t = normalizedZ;  // 0.0 〜 1.0
                // Zを伸ばす（lengthFactorで制御）
                const zNew = lengthFactor * Math.pow(t, 0.7);  // やや急に伸びて尖る
                positions[i + 2] = zNew;

                // 横方向を先細り（taper）
                const scale = 1.0 - (taperSharpness - 1.0) * Math.pow(t, 1.2);
                positions[i] *= scale;
                positions[i + 1] *= scale;
            } 
            else {
                // -Z側（頭部側）：適度に潰して平らにし、横幅を少し広げる（脚の基部を確保）
                const t = -normalizedZ;  // 0.0 〜 1.0
                // Zを平たく（headFlattenで制御）
                const zNew = -headFlatten * Math.pow(t, 0.4);  // 強く潰しすぎず底面確保
                positions[i + 2] = zNew;

                // 横方向：頭部側を少し広く（イカらしい太さ）
                const scale = 1.0 + (headWidth - 1.0) * (1.0 - Math.pow(t, 0.6));
                positions[i] *= scale;
                positions[i + 1] *= scale;
            }
        }

        mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        // mesh.refreshBoundingInfo();
    }

    update(time, delta){

        if (this.state === STATE_COOLDOWN){
            this.state_counter -= delta / 1000;
            if (this.state_counter < 0){
                this.tmp_target.copyFromFloats(Math.random()*2 -1, Math.random()*2 -1, Math.random()*2 -1);
                this.state = STATE_ALIGNING;
            }
        } else if (this.state === STATE_ALIGNING){
            this.tmp_target.subtractToRef(this.root.position, this.tmp_toTarget);
            if (this.tmp_toTarget.lengthSquared() < 1e-8) {
                // 既に目的地にいる（ゼロベクトル対策）
                this.state = STATE_COOLDOWN;
                this.state_counter = 1;
            } else {
                this.tmp_toTarget.normalize();
                this.rotate_to(this.tmp_toTarget, delta);
                BABYLON.Vector3.TransformNormalToRef( BABYLON.Axis.Z, this.root.getWorldMatrix(), this.tmp_forward );
                this.tmp_forward.normalize();
                const dot = BABYLON.Vector3.Dot(this.tmp_toTarget, this.tmp_forward);
                if ( dot > 0.99){
                    // 方向が合ったらジェット噴射して、あとは惰性
                    this.control_velocity.copyFrom(this.tmp_toTarget);
                    this.control_velocity.scaleInPlace(this.genome.speed);
                    this.state = STATE_COOLDOWN;
                    this.state_counter = 2 + Math.random() * 3;
                }
            }
        }
        this.control_velocity.scaleInPlace(0.98);
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }
}