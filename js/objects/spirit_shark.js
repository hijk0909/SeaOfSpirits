// spirit_shark.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Spirit } from "./base_spirit.js";
import { MyDraw } from "../utils/DrawUtils.js";

const MAX_CANDIDATES = 5;
const SEARCH_COOLDOWN_PERIOD = 1.0;

// サメ
export class Spirit_Shark extends Spirit {
    constructor(scene, class_name, generation){    
        super(scene, class_name, generation);

        // クラス遺伝子
        this.genome.disp_scale = 1.0;
        this.genome.collision_radius = 1.0;
        this.genome.is_collidable = true;
        this.genome.mass = 2.5;
        this.genome.hp_max = 300;
        this.genome.hp_decrease = 0.102;
        this.genome.rotate_speed = 1.6;
        this.genome.speed = 0.115;
        this.genome.accel = 0.0012;
        this.genome.predation_classes = ["Spirit_Fish", "Spirit_Squid"];
        this.genome.predation_socket = {front : 0.0, theta : -5.0 , phi : 0.0};
        this.genome.predation_radius = 0.5;

        // クラス固有のパラメータ
        this.target = null;
        this.visibleRadius = 18.0;  //視野半径
        this.slowRadius = 2.5;      //接近時減速半径
        this.arrivalRadius = 0.2;   //到着判定半径
        this.minSpeedRatio = 0.03;
        this.search_cooldown_counter = 0;
        this.chasePeriod = 2.0 * (0.4 + Math.random() * 1.2); //追跡時間：個体による「ゆらぎ」
        this.chaseTimer = this.chasePeriod;
        this.base_color = new BABYLON.Color3();
        this.texture_color_1 = new BABYLON.Color3();
        this.texture_color_2 = new BABYLON.Color3();

        // テンポラリ変数
        this.tmp_target = new BABYLON.Vector3();
        this.tmp_toTarget = new BABYLON.Vector3();
        this.tmp_desiredVelocity = new BABYLON.Vector3();
        this.tmp_steering = new BABYLON.Vector3();
        this.tmp_forward = new BABYLON.Vector3();
        this.tmp_controlNorm = new BABYLON.Vector3();
        this.tmp_candidates = [MAX_CANDIDATES];
    }

    create(genome_modifier){
        this.base_color.copyFromFloats(0.5, 0.7, 1.0);

        const speed_ratio = genome_modifier?.speed ?? 1.0;
        this.texture_color_1.copyFrom(MyDraw.saturatedColor(speed_ratio));
        this.texture_color_2.copyFromFloats(0.2, 0.2, 0.2);
        // console.log("SHARK speed_ratio:", genome_modifier.speed, speed_ratio);

        super.create(genome_modifier);
    }

    _set_shared_materials(){
        let mat;

        mat = new BABYLON.PBRMaterial("eye", this.scene);
        mat.albedoColor = new BABYLON.Color3(1.0, 0.0, 0.0);
        mat.emissiveColor =   new BABYLON.Color3(6.0, 0.0, 0.0);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("eye", mat);

        mat = new BABYLON.PBRMaterial("lip", this.scene);
        mat.albedoColor = new BABYLON.Color3(1.0, 0.0, 0.0);
        mat.metallic = 0.2;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("lip", mat);

        mat = new BABYLON.PBRMaterial("tooth", this.scene);
        mat.albedoColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("tooth", mat);

        mat = new BABYLON.PBRMaterial("parts", this.scene);
        mat.albedoColor = this.base_color;
        mat.metallic = 1.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.shared_materials.set("parts", mat);

        mat = null;

        this.remain_color.copyFrom(this.texture_color_1);
    }

    _create_body(){
        // console.trace("_create_body called");
        this.mesh = BABYLON.MeshBuilder.CreateSphere( "body", { diameterZ: 3.5, diameterX: 1.5, diameterY: 2.0, segments: 16, updatable: true, sideOrientation: BABYLON.Mesh.FRONTSIDE }, this.scene );

        this.mesh.position = new BABYLON.Vector3(0,0,0);
        this.mesh.checkCollisions = false;
        this.mesh.isPickable = false;
        this.mesh.parent = this.root;

        const mat = new BABYLON.PBRMaterial("shark-body-material", this.scene); 
        mat.albedoTexture = this.get_perlin_texture(this.texture_color_1, this.texture_color_2);

        mat.metallic = 0.0;
        mat.roughness = 1.0;
        mat.alpha = 1.0;
        this.mesh.material = mat;
    }

    _set_attachment_definitions(){

        let def;

        const mouth_scale = this.genome_modifier?.predation_radius ?? 1.0;
        def = {
            name: "Attachment_Mouth",
            socket: {front:0.0, thetaDeg:-5, phiDeg:0},
            params: {hasTeeth : true, biteSpeed : 3.0, scale : mouth_scale, lip_material_key : "lip", tooth_material_key : "tooth", offset : -0.1}
        };
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Tail",
            socket: {front:0.0, thetaDeg:0, phiDeg:180},
            params: {scale : 1.5, material_key : "parts"}
        };
        this.attachment_definitions.push(structuredClone(def));

        def = {
            name: "Attachment_Fin",
            socket: {front:0.0, thetaDeg:+75, phiDeg:0},
            params: {bottomScale : 1.0, height : 1.5, twist : 90, material_key : "parts"}
        }
        this.attachment_definitions.push(structuredClone(def));

        def.socket = {front:-0.3, thetaDeg:-25, phiDeg:-30};
        def.params = {bottomScale : 1.5, height : 2.0, twist : 90, material_key : "parts"};
        this.attachment_definitions.push(structuredClone(def));
        def.socket.phiDeg *= -1;
        this.attachment_definitions.push(structuredClone(def));

        def.socket = {front:-0.8, thetaDeg:+45, phiDeg: 180};
        def.params = {bottomScale : 0.6, height : 1.1, material_key : "parts"};
        this.attachment_definitions.push(structuredClone(def));

        def.socket = {front:-0.8, thetaDeg:-35, phiDeg: 180};
        def.params = {bottomScale : 0.6, height : 1.1, material_key : "parts"};
        this.attachment_definitions.push(structuredClone(def));
        
        def = {
            name: "Attachment_Eye",
            socket: {front:0.8, thetaDeg:+45, phiDeg:-55},
            params: {scale : 1.0, material_key : "eye"}
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

    search_target(){

        // 候補抽出
        const radiusSq = this.visibleRadius * this.visibleRadius;
        let bestPrey = null;
        let bestDistSq = Infinity;

        // 上位MAX_CANDIDATES件を保持（固定長）
        const candidates = this.tmp_candidates;
        let count = 0;

        for (let i = 0; i < GameState.spirits.length; i++) {
            const s = GameState.spirits[i];
            if (!s.alive || s.dying) continue;
            if (!this.genome.predation_classes.includes(s.class_name)) continue;

            const dx = s.root.position.x - this.root.position.x;
            const dy = s.root.position.y - this.root.position.y;
            const dz = s.root.position.z - this.root.position.z;
            const distSq = dx*dx + dy*dy + dz*dz;

            if (distSq >= radiusSq) continue;

            // 上位MAX_CANDIDATES件に入れる（挿入ソート）
            if (count < MAX_CANDIDATES) {
                candidates[count++] = { spirit: s, distSq };
            } else {
                // 最大要素を探して置換
                let maxIdx = 0;
                for (let j = 1; j < 5; j++) {
                    if (candidates[j].distSq > candidates[maxIdx].distSq) maxIdx = j;
                }
                if (distSq < candidates[maxIdx].distSq) candidates[maxIdx] = { spirit: s, distSq };
            }
        }

        // 仲間探索
        let hasFriend = false;

        for (let i = 0; i < GameState.spirits.length; i++) {
            const s = GameState.spirits[i];

            if (s === this || !s.alive || s.class_name !== this.class_name) continue;

            const dx = s.root.position.x - this.root.position.x;
            const dy = s.root.position.y - this.root.position.y;
            const dz = s.root.position.z - this.root.position.z;

            if (dx*dx + dy*dy + dz*dz < radiusSq) {
                hasFriend = true;
                break;
            }
        }

        // ターゲット選択
        if (count > 0) {

            if (!hasFriend) {
                // 最も近い対象を選択
                let best = candidates[0];
                for (let i = 1; i < count; i++) {
                    if (candidates[i].distSq < best.distSq) {
                        best = candidates[i];
                    }
                }
                this.target = best.spirit;

            } else {
                // 仲間から最も遠い対象を選択
                let bestScore = -1;
                let bestSpirit = null;

                for (let i = 0; i < count; i++) {
                    const prey = candidates[i].spirit;

                    let minDist = Infinity;

                    for (let j = 0; j < GameState.spirits.length; j++) {
                        const f = GameState.spirits[j];

                        if (f === this || !f.alive || f.class_name !== this.class_name) continue;

                        const dx = f.root.position.x - prey.root.position.x;
                        const dy = f.root.position.y - prey.root.position.y;
                        const dz = f.root.position.z - prey.root.position.z;

                        const d = dx*dx + dy*dy + dz*dz;
                        if (d < minDist) minDist = d;
                    }

                    if (minDist > bestScore) {
                        bestScore = minDist;
                        bestSpirit = prey;
                    }
                }
                this.target = bestSpirit;
            }

            this.chaseTimer = this.chasePeriod;
        }
    }

    chase_target(delta){
        this.tmp_target.copyFrom(this.target.root.position);

        // ターゲットに向かう速度計算
        this.tmp_target.subtractToRef(this.predation_position, this.tmp_toTarget);
        const distance = this.tmp_toTarget.length();
        if ( distance < this.arrivalRadius ){
            this.control_velocity.set(0,0,0); //角度振動を防ぐため完全停止
        } else {
            let desiredSpeed = this.genome.speed;
            if (distance < this.slowRadius) {
                desiredSpeed *= distance / this.slowRadius; //目的地到着時の振動を防ぐ
            } else {
                BABYLON.Vector3.TransformNormalToRef(
                    BABYLON.Axis.Z,
                    this.root.getWorldMatrix(),
                    this.tmp_forward
                );
                this.tmp_forward.normalize();
                this.control_velocity.normalizeToRef(this.tmp_controlNorm);
                let dot = BABYLON.Vector3.Dot(this.tmp_controlNorm, this.tmp_forward);
                // desiredSpeed を差異角度が大きいほど減衰
                if (dot <= 0) {
                    desiredSpeed = this.minSpeedRatio;
                } else {
                    desiredSpeed *= (dot * (1-this.minSpeedRatio)+ this.minSpeedRatio);
                }
            }
            this.tmp_toTarget.normalizeToRef(this.tmp_desiredVelocity);
            this.tmp_desiredVelocity.scaleInPlace(desiredSpeed);
            this.tmp_desiredVelocity.subtractToRef(this.control_velocity, this.tmp_steering);
            
            // 加速度制限
            if (this.tmp_steering.length() > this.accel) {
                this.tmp_steering.normalize();
                this.tmp_steering.scaleInPlace(this.accel);
            }
            this.control_velocity.addInPlace(this.tmp_steering);
            this.rotate_to(this.control_velocity, delta);
        }

        // 同一敵の追跡期間を限定
        this.chaseTimer -= delta / 1000;
        if (this.chaseTimer < 0){
            this.target = null;
        }
    }

    update(time, delta){

        if ( !this.target || !this.target.alive){
            this.search_cooldown_counter += delta / 1000;
            if (this.search_cooldown_counter > SEARCH_COOLDOWN_PERIOD){
                this.search_cooldown_counter = 0;
                this.search_target();
            }
        }

        if ( this.target && this.target.alive){
            this.chase_target(delta);
        }
        super.update(time, delta);
    }

    dispose(){
        super.dispose();
    }

}