// base_spirit.js
import { GLOBALS } from '../GameConst.js';
import { GameState } from "../GameState.js";
import { Collidable } from "./base_collidable.js";
import { Attachment_Tentacle} from "./attachment_tentacle.js";
import { Attachment_Spine} from "./attachment_spine.js";
import { Attachment_Tail} from "./attachment_tail.js";
import { Attachment_Eye} from "./attachment_eye.js";
import { Attachment_Mouth} from "./attachment_mouth.js";
import { Attachment_Fin} from "./attachment_fin.js";

const FLASH_TIME = 0.15; //秒
const FALSH_INTENSITY = 0.3;
const LOD_THRESHOLD = 12.0;

export class Spirit extends Collidable {

    constructor(scene, class_name, generation){
        super(scene, class_name);

        this.generation = generation;
        this.genome = {
            hp_max : 100,
            hp_decrease : 0.1,
            mass : 1.0,
            disp_scale : 1.0,
            is_collidable : true, 
            collision_radius : 0.5,
            rotate_speed : 1.5,
            speed : 0.1,
            accel : 0.01,
            predation_classes : [],
            predation_socket : {front:0.0, theta:0.0, phi:0.0},
            predation_radius : 0.2
        }
        this.genome_modifier = {};

        this.attachments = [];
        this.attachment_definitions = [];
        this.AttachmentClassList = {
            'Attachment_Eye'       : Attachment_Eye,
            'Attachment_Fin'       : Attachment_Fin,
            'Attachment_Mouth'     : Attachment_Mouth,
            'Attachment_Spine'     : Attachment_Spine,
            'Attachment_Tail'      : Attachment_Tail,
            'Attachment_Tentacle'  : Attachment_Tentacle
        }

        this.predation_socket = null;
        this.predation_position = new BABYLON.Vector3();

        this.emissive_materials = [];
        this.base_emissive_color = new BABYLON.Color3();
        this.flash_time = 0;
        this.base_alpha = 1.0;

        this.remain_color = new BABYLON.Color3(1.0, 1.0, 1.0);

        this.shared_materials = new Map(); // 共有マテリアル

        this.prev_LOD = false; //1フレーム前のLOD

        this.clone_observers = [];

        // [DEBUG] 当たり判定の可視化
        this.debugEllipsoid = null;
    }

    // genomeの変更
    modify_genome(genome_modifier){
        const genomeOps = {
            hp_max:                 (g, v) => g.hp_max              *= v,
            hp_decrease:            (g, v) => g.hp_decrease         *= v,
            disp_scale:             (g, v) => g.disp_scale          *= v,
            collision_radius:       (g, v) => g.collision_radius    *= v,
            mass:                   (g, v) => g.mass                *= v,
            speed:                  (g, v) => g.speed               *= v,
            rotate_speed:           (g, v) => g.rotate_speed        *= v,
            accel:                  (g, v) => g.accel               *= v,
            predation_radius:       (g, v) => g.predation_radius    *= v,
            predation_classes:      (g, v) => g.predation_classes   = v
        };

        for (const key in genome_modifier) {
            if (genomeOps[key]) {
                genomeOps[key](this.genome, genome_modifier[key]);
            }
        }
    }

    // genomeからプロパティを設定
    // （※親クラスは genomeを直接参照しない）
    set_property_from_genome(){
        this.hp = this.genome.hp_max;
        this.hp_decrease = this.genome.hp_decrease;
        this.mass = this.genome.mass;
        this.collisionRadius = this.genome.collision_radius;
        this.isCollidable = this.genome.is_collidable;
        this.rotate_speed = this.genome.rotate_speed;
    }

    create(genome_modifier){
        // genomeの修正
        this.genome_modifier = genome_modifier;
        this.modify_genome(genome_modifier);

        // 属性の設定
        this.set_property_from_genome();

        // 共有マテリアルの設定
        this._set_shared_materials();

        // ボディの生成
        this._create_body();
        this.mesh.computeWorldMatrix(true);

        // 捕食口の座標設定（socket → position）
        if (this.genome.predation_classes.length > 0){
            const {front, theta, phi} = this.genome.predation_socket;
            this.predation_socket = this.get_socket(this.mesh, front, theta, phi);
        }

        // アタッチメントの定義
        this.attachment_definitions.length = 0;
        this._set_attachment_definitions();

        // アタッチメントの定義を実体化
        for (const def of this.attachment_definitions){
            const socket = this.get_socket(this.mesh, def.socket.front, def.socket.thetaDeg, def.socket.phiDeg);
            if (socket){
                const Attachment_Class = this.AttachmentClassList[def.name];
                //（注）BABYLON.Color3, BABYLON.Vector3 などは structuredClone でプレーンオブジェクトに劣化する
                // 色情報は、BABYLON.Color3オブジェクトに組み立て直す
                if (def.params.color){ 
                    def.params.color = new BABYLON.Color3(def.params.color.r, def.params.color.g, def.params.color.b);
                }
                if (def.params.emissive){
                    def.params.emissive = new BABYLON.Color3(def.params.emissive.r, def.params.emissive.g, def.params.emissive.b);
                }
                const attachment = new Attachment_Class(this, socket, def.params);
                this.attachments.push(attachment);
            }
        }

        // ボディの表示用の大きさを調整（アタッチメントを全てくっつけてから）
        this.mesh.scaling = new BABYLON.Vector3(this.genome.disp_scale, this.genome.disp_scale, this.genome.disp_scale);

        // emmisiveColor のある 全マテリアルの収集
        // clone（個別化）のある マテリアルに限定する
        this.root.getChildMeshes().forEach(m => {
            if (m.material && typeof m.material.clone === "function"){ //cloneの無いmaterialを除外
                // m.material = m.material.clone(); //キャラクターごとに個別に点滅させるため
                if (m.material.emissiveColor){
                    m.material._emissiveBase = m.material.emissiveColor.clone();
                    this.emissive_materials.push(m.material);
                }
            }
        });
    }

    _set_shared_materials(){
        // 共有用マテリアルの設定（継承先でオーバーライド）
    }

    _create_body(){
        // ボディの定義（継承先でオーバーライド）
    }

    _set_attachment_definitions(){
        // アタッチメントの定義（継承先でオーバーライド）
    }

    activate(pos){
        this.set_property_from_genome();

        this.root.setEnabled(true);
        this.root.position.copyFrom(pos);
        this.set_alpha(this.base_alpha);

        super.activate(pos);
    }

    deactivate(){
        this.root.setEnabled(false);
        super.deactivate();
    }

    // 半透明用 depthClone を 生成
    setupDepthClone(){
        // アタッチメントをボディの背後に隠すための、深度情報を更新するためだけの mesh を作成
        const characterMeshes = this.root.getChildMeshes(false);
        characterMeshes.forEach(mesh => {
            // 子をクローンしない（第三引数 = true）
            const depthClone = mesh.clone(mesh.name + "_depth", null, true);
            depthClone.isPickable = false;
            depthClone.receiveShadows = false;

            const depthMat = new BABYLON.StandardMaterial("depthMat_" + mesh.name, this.scene);
            depthMat.disableColorWrite = true;
            depthMat.forceDepthWrite = true;
            depthMat.backFaceCulling = true;
            depthClone.material = depthMat;

            // オリジナルは PrePassせず、深度情報を書き込まない
            mesh.material.needDepthPrePass = false;
            mesh.material.forceDepthWrite = false;

            // 親が TransformNode でない場合、rotationQuaternion のアニメーションを同期
            if (!(mesh.parent instanceof BABYLON.TransformNode) || 
                mesh.parent instanceof BABYLON.AbstractMesh) {
                const observer = this.scene.onBeforeRenderObservable.add(() => {
                    if (mesh.rotationQuaternion) {
                        if (!depthClone.rotationQuaternion) {
                            depthClone.rotationQuaternion = mesh.rotationQuaternion.clone();
                        } else {
                            depthClone.rotationQuaternion.copyFrom(mesh.rotationQuaternion);
                        }
                    }
                });
                this.clone_observers.push(observer);
            }
        });
    }

    // 半透明描画用 depthClone を scene.mesh の最後尾に強制的に回す
    static setupDepthCloneRenderOrder(scene) {
        scene.setRenderingOrder(
            0,  // renderingGroupId = 0（デフォルトグループ）
            (subMeshA, subMeshB) => {  // opaque 用の比較関数
                const isDepthA = subMeshA.getRenderingMesh().name.endsWith("_depth");
                const isDepthB = subMeshB.getRenderingMesh().name.endsWith("_depth");

                if (isDepthA && !isDepthB) return 1;   // depthClone を後ろに
                if (!isDepthA && isDepthB) return -1;  // 通常メッシュを前に
                return 0;  // その他は現状維持
            },
            null,  // alphaTest 用（使わない）
            null   // transparent 用（使わない）
        );
    }

    // デバッグ用のellipsoid可視化
    create_debug_ellipsoid(ellipsoid){
        this.debugEllipsoid = BABYLON.MeshBuilder.CreateSphere("debugEllipsoid", {
            diameterX: ellipsoid.x * 2,
            diameterY: ellipsoid.y * 2,
            diameterZ: ellipsoid.z * 2
        }, this.scene);

        this.debugEllipsoid.material = new BABYLON.StandardMaterial("debugMat", this.scene);
        this.debugEllipsoid.material.wireframe = true;
        this.debugEllipsoid.material.emissiveColor = new BABYLON.Color3(1, 0, 0);

        // 毎フレーム追従
        this.scene.registerBeforeRender(() => {
            if (this.mesh && this.debugEllipsoid){
                this.debugEllipsoid.position = this.collider.position.add(this.collider.ellipsoidOffset || BABYLON.Vector3.Zero());
            }
        });
    }

    get_stripe_texture(color1, color2, uScale = 20, vScale = 1) {
        // 横2px（左半分=color1、右半分=color2）× 縦1px の最小テクスチャ
        const width = 2;
        const height = 1;
        const data = new Uint8Array(width * height * 4);

        // 左ピクセル: color1
        data[0] = Math.round(color1.r * 255);
        data[1] = Math.round(color1.g * 255);
        data[2] = Math.round(color1.b * 255);
        data[3] = 255;

        // 右ピクセル: color2
        data[4] = Math.round(color2.r * 255);
        data[5] = Math.round(color2.g * 255);
        data[6] = Math.round(color2.b * 255);
        data[7] = 255;

        const texture = BABYLON.RawTexture.CreateRGBATexture(
            data,
            width,
            height,
            this.scene,
            false,              // generateMipMaps: 小さなテクスチャなので不要
            false,              // invertY
            BABYLON.Texture.NEAREST_SAMPLINGMODE  // ぼかさずシャープに縞を描画
        );

        // 縞の数
        texture.uScale = uScale;
        texture.vScale = vScale;
        // 継ぎ目を綺麗にするリピート設定
        texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;

        // dispose() 用に保存
        this.texture = texture;
        return texture;
    }

    get_perlin_texture(c1, c2, frequency = 4) {
        const size = 32;
        const data = new Uint8Array(size * size * 4);

        // 格子点ごとに「勾配ベクトル」を決定論的に生成
        const gradAngle = (ix, iy) => {
            // 周期境界を保証するため % frequency してからハッシュ
            const px = ((ix % frequency) + frequency) % frequency;
            const py = ((iy % frequency) + frequency) % frequency;
            let h = px * 1597334677 ^ py * 3812015801;
            h = Math.imul(h ^ (h >>> 15), h | 1);
            h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
            return ((h ^ (h >>> 14)) >>> 0) / 4294967296 * Math.PI * 2;
        };

        const dot_grad = (ix, iy, fx, fy) => {
            const angle = gradAngle(ix, iy);
            return Math.cos(angle) * fx + Math.sin(angle) * fy;
        };

        const fade  = (t) => t * t * t * (t * (t * 6 - 15) + 10); // 五次（Ken Perlins改良版）
        const lerp  = (a, b, t) => a + t * (b - a);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u  = (x / size) * frequency;
                const v  = (y / size) * frequency;
                const x0 = Math.floor(u);
                const y0 = Math.floor(v);
                const x1 = x0 + 1;
                const y1 = y0 + 1;
                // 格子点からの相対距離
                const dx0 = u - x0,  dy0 = v - y0;
                const dx1 = u - x1,  dy1 = v - y1;

                const fu = fade(dx0);
                const fv = fade(dy0);

                // 各格子点の勾配との内積（% frequency はgradAngle内部で処理）
                const n00 = dot_grad(x0, y0,  dx0,  dy0);
                const n10 = dot_grad(x1, y0,  dx1,  dy0);
                const n01 = dot_grad(x0, y1,  dx0,  dy1);
                const n11 = dot_grad(x1, y1,  dx1,  dy1);

                const nx0 = lerp(n00, n10, fu);
                const nx1 = lerp(n01, n11, fu);

                // Gradient Noiseの出力範囲は約[-0.7, 0.7]なので0〜1に正規化
                const t = lerp(nx0, nx1, fv) * 0.7071 * 0.5 + 0.5;
                const tc = Math.max(0, Math.min(1, t));

                const i = (y * size + x) * 4;
                data[i]     = (lerp(c1.r, c2.r, tc) * 255) | 0;
                data[i + 1] = (lerp(c1.g, c2.g, tc) * 255) | 0;
                data[i + 2] = (lerp(c1.b, c2.b, tc) * 255) | 0;
                data[i + 3] = 255;
            }
        }
        const texture = BABYLON.RawTexture.CreateRGBATexture(
            data, size, size, this.scene,
            false, false,
            BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
            BABYLON.Constants.TEXTURETYPE_UNSIGNED_BYTE
        );
        this.texture = texture;
        return texture;
    }

    get_spot_texture(c1, c2, num = 10) {
        const size = 32;
        const margin = 2;
        const inner = size - margin * 2; // 点を配置する内側領域の一辺

        // ランダムな点を生成
        const points = [];
        for (let i = 0; i < num; i++) {
            points.push({
                x: margin + Math.random() * inner,
                y: margin + Math.random() * inner,
            });
        }

        const lerp = (a, b, t) => a + (b - a) * t;
        const dist2 = (ax, ay, bx, by) => {
            let dx = Math.abs(ax - bx);
            let dy = Math.abs(ay - by);
            if (dx > size / 2) dx = size - dx; // 境界をまたぐ最短距離
            if (dy > size / 2) dy = size - dy;
            return dx * dx + dy * dy;
        };

        // ピクセルの色を決定
        const data = new Uint8Array(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // 最近傍 d1、2番目 d2 を探す
                let d1 = Infinity, d2 = Infinity;
                for (const p of points) {
                    const d = dist2(x, y, p.x, p.y);
                    if (d < d1) {
                        d2 = d1;
                        d1 = d;
                    } else if (d < d2) {
                        d2 = d;
                    }
                }
                // d1=0 の場合のゼロ除算ガード
                const sum = d1 + d2;
                const rawT = sum > 0 ? d1 / sum : 0; // 0(中心) ～ 0.5(境界)
                // 0～0.5 を 0～1 に正規化してスムーズステップ
                const t01 = Math.min(rawT * 2, 1.0);           // 線形 0→1
                const tc  = t01 * t01 * (3 - 2 * t01);        // smoothstep

                const idx = (y * size + x) * 4;
                data[idx    ] = (lerp(c2.r, c1.r, tc) * 255) | 0;
                data[idx + 1] = (lerp(c2.g, c1.g, tc) * 255) | 0;
                data[idx + 2] = (lerp(c2.b, c1.b, tc) * 255) | 0;
                data[idx + 3] = 255;
            }
        }

        // BABYLON テクスチャ生成
        const texture = BABYLON.RawTexture.CreateRGBATexture(
            data, size, size, this.scene,
            false, false,
            BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
            BABYLON.Constants.TEXTURETYPE_UNSIGNED_BYTE
        );
        return texture;
    }

    flash(){
        this.flash_time = FLASH_TIME;
    }

    set_emissive_base(color){
        this.emissive_materials.forEach(mat => {
            mat._emissiveBase.copyFrom(color);
            mat.emissiveColor.copyFrom(color);
        });
    }

    set_emissive_flash(t=0){
        this.emissive_materials.forEach(mat => {
            mat.emissiveColor.set(
                mat._emissiveBase.r + t * FALSH_INTENSITY,
                mat._emissiveBase.g + t * FALSH_INTENSITY,
                mat._emissiveBase.b + t * FALSH_INTENSITY
            )
        });
    }

    set_alpha(t=0){
        this.emissive_materials.forEach(mat => {mat.alpha = t;});
    }

    set_dying(){
        this.set_emissive_flash(0);
        super.set_dying();
    }

    get_socket(body_mesh, front, thetaDeg, phiDeg){
        const forward = new BABYLON.Vector3(0, 0, 1);
        const origin = body_mesh.getAbsolutePosition().add(forward.scale(front));

        const theta = BABYLON.Tools.ToRadians(thetaDeg); // 緯度
        const phi   = BABYLON.Tools.ToRadians(phiDeg);   // 経度
        const x = Math.cos(theta) * Math.sin(phi);
        const y = Math.sin(theta);
        const z = Math.cos(theta) * Math.cos(phi);
        const direction = new BABYLON.Vector3(x, y, z).normalize();

        const ray = new BABYLON.Ray(origin, direction, 10); // 10 は十分大きい距離
        const hit = this.scene.pickWithRay(ray, mesh => mesh === body_mesh);
        if (hit.hit) {
            const worldSocketPosition = hit.pickedPoint;
            const worldSocketNormal = hit.getNormal(true);
            const inv = body_mesh.getWorldMatrix().clone().invert();
            const localSocketPosition = BABYLON.Vector3.TransformCoordinates(worldSocketPosition, inv);
            const localSocketNormal = BABYLON.Vector3.TransformNormal(worldSocketNormal, inv);
            return { position: localSocketPosition, normal: localSocketNormal };
        } else {
            return null; // z が外側だったなど
        }
    }

    update(time, delta){
        if (this.dying){
            this.set_alpha(this.dying_ratio);
        } else {
            // 空腹化
            this.hp -= this.hp_decrease;
            if (this.hp < 0){
                this.set_dying();
                GameState.spawn.spirit_class_state[this.class_name].num_starved += 1;
                // console.log("starvation:", this.class_name);
                GameState.spawn.activate_effect("Effect_Extinction", this.root.position, { size : this.collisionRadius});
                GameState.remains.add_remain(this.root.position, this.remain_color, this.collisionRadius);
                GameState.asset.se.extinction.play_3D(this.root.position);
            }

            // 環境流の計算
            this.environment_velocity = GameState.player.get_environment_velocity(this.root.position);

            // 捕食座標の更新
            if (this.predation_socket){
                // ソケット位置を親（this.mesh） のワールド行列でワールド空間に変換
                BABYLON.Vector3.TransformCoordinatesToRef(
                    this.predation_socket.position,
                    this.mesh.getWorldMatrix(),
                    this.predation_position
                );
            }

            // フラッシュ
            if (this.flash_time > 0) {
                this.flash_time -= delta / 1000;
                const t = Math.max(0, this.flash_time / FLASH_TIME); // 1→0
                this.set_emissive_flash(t);
            }

            // LOD（表示詳細度の制御）
            if (this.prev_LOD){
                if (this.root.position.z < LOD_THRESHOLD){
                    this.prev_LOD = false;
                    for (const attachment of this.attachments) attachment.setEnabled(true);
                }
            } else {
                if (this.root.position.z > LOD_THRESHOLD){
                    this.prev_LOD = true;
                    for (const attachment of this.attachments) attachment.setEnabled(false);
                }
            }
            if (!this.prev_LOD){
                for (const attachment of this.attachments){
                    attachment.update(time, delta);
                }
            }
        }
        super.update(time, delta);
    }

    dispose(){

        if (this.debugEllipsoid){
            this.debugEllipsoid.dispose();
            this.debugEllipsoid = null;
        }

        // 共有マテリアルの廃棄
        for (const material of this.shared_materials.values()) {
            material.dispose();
        }

        // アタッチメントの廃棄
        for (const attachment of this.attachments){
            attachment.dispose();
        }

        // ボディ用のテクスチャの廃棄
        if (this.texture) {
            if (this.mesh?.material instanceof BABYLON.PBRMaterial) {
                this.mesh.material.albedoTexture = null;
            } else if (this.mesh?.material instanceof BABYLON.StandardMaterial) {
                this.mesh.material.diffuseTexture = null;
            }
            this.texture.dispose();
            this.texture = null;
        }

        // 半透明クローン用のオブザーバの廃棄
        this.clone_observers.forEach(obs => {
            this.scene.onBeforeRenderObservable.remove(obs);
        });
        this.clone_observers.length = 0;

        super.dispose();
    }

} // End of Spirit