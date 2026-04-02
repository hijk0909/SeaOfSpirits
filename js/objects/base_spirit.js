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

        this.prev_LOD = false; //1フレーム前のLOD

        // [DEBUG] 当たり判定の可視化
        this.debugEllipsoid = null;
    }

    // genomeの変更
    modify_genome(genome_modifier){
        const genomeOps = {
            hp_max:                 (g, v) => g.hp_max   *= v,
            mass:                   (g, v) => g.mass     *= v,
            speed:                  (g, v) => g.speed    *= v,
            accel:                  (g, v) => g.accel    *= v,
            predation_radius:       (g, v) => g.predation_radius *= v,
            predation_classes:      (g, v) => g.predation_classes = v
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
        this.modify_genome(genome_modifier);

        // 属性の設定
        this.set_property_from_genome();

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
                m.material = m.material.clone(); //キャラクターごとに個別に点滅させるため
                if (m.material.emissiveColor){
                    m.material._emissiveBase = m.material.emissiveColor.clone();
                    this.emissive_materials.push(m.material);
                }
            }
        });
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
                this.scene.onBeforeRenderObservable.add(() => {
                    if (mesh.rotationQuaternion) {
                        if (!depthClone.rotationQuaternion) {
                            depthClone.rotationQuaternion = mesh.rotationQuaternion.clone();
                        } else {
                            depthClone.rotationQuaternion.copyFrom(mesh.rotationQuaternion);
                        }
                    }
                });
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
        const size = 4; // 小さくして toDataURL() の負荷を最小化
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = color1; // 地の色
        ctx.fillRect(0, 0, size/2, size);
        ctx.fillStyle = color2; // 縞の色
        ctx.fillRect(size/2, 0, size/2, size);

        const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene);
        
        // 縞の数
        texture.uScale = uScale; 
        texture.vScale = vScale;

        // 継ぎ目を綺麗にするリピート設定
        texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        
        return texture;
    }

get_perlin_texture(c1, c2, frequency = 16) {
    const size = 128;
    const data = new Uint8Array(size * size * 4);

    const hash = (x, y) => {
        let h = (x | 0) * 1597334677 ^ (y | 0) * 3812015801;
        h = Math.imul(h ^ (h >>> 15), h | 1);
        h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
        return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
    };

    const lerp = (a, b, t) => a + t * (b - a);
    const fade = (t) => t * t * (3 - 2 * t);

    /*
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    const c1r = (c1 >> 16) & 0xFF, c1g = (c1 >> 8) & 0xFF, c1b = c1 & 0xFF;
    const c2r = (c2 >> 16) & 0xFF, c2g = (c2 >> 8) & 0xFF, c2b = c2 & 0xFF;
    */

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = (x / size) * frequency;
            const v = (y / size) * frequency;

            const x0 = Math.floor(u);
            const y0 = Math.floor(v);

            const x1 = (x0 + 1) % frequency; 
            const y1 = (y0 + 1) % frequency;

            const fu = fade(u - x0);
            const fv = fade(v - y0);

            const n00 = hash(x0 % frequency, y0 % frequency);
            const n10 = hash(x1, y0 % frequency);
            const n01 = hash(x0 % frequency, y1);
            const n11 = hash(x1, y1);

            const nx0 = lerp(n00, n10, fu);
            const nx1 = lerp(n01, n11, fu);
            const t = lerp(nx0, nx1, fv);

            const i = (y * size + x) * 4;
            data[i]     =  (lerp(c1.r, c2.r, t) * 255) | 0;
            data[i + 1] =  (lerp(c1.g, c2.g, t) * 255) | 0;
            data[i + 2] =  (lerp(c1.b, c2.b, t) * 255) | 0;
            data[i + 3] = 255;
        }
    }

    // CreateRGBATexture の引数
    // 第5引数: generateMipMaps (boolean)
    // 第6引数: invertY (boolean)
    // 第7引数: samplingMode (number)
    // 第8引数: type (number)
    const texture = BABYLON.RawTexture.CreateRGBATexture(
        data, size, size,  this.scene, 
        false,  false,
        BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
        BABYLON.Constants.TEXTURETYPE_UNSIGNED_BYTE
    );

    return texture;
}


/*
get_perlin_texture(color1, color2, repeat = false) {
    const size = 64;
    const frequency = 32; // タイル周期（整数にすること）

    // --- パーリンノイズのセットアップ ---
    // permテーブルを使うことで hash(x % freq) == hash(x) が保証される
    const PERM_SIZE = 256;
    const perm = new Uint8Array(PERM_SIZE);
    for (let i = 0; i < PERM_SIZE; i++) perm[i] = i;
    // シャッフル（固定シード）
    let seed = 12345;
    const rand = () => {
        seed = Math.imul(seed, 1664525) + 1013904223 | 0;
        return (seed >>> 0) / 4294967296;
    };
    for (let i = PERM_SIZE - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }

    // 周期 `freq` で折り返すハッシュ
    // xi, yi は必ず 0..freq-1 の範囲で渡す → タイル境界で連続
    const grad2 = [
        [1,1],[-1,1],[1,-1],[-1,-1],
        [1,0],[-1,0],[0,1],[0,-1]
    ];
    const gradHash = (xi, yi) => {
        // 周期テーブルを freq で折り返してインデックスを作る
        const idx = perm[(perm[xi % PERM_SIZE] + yi) % PERM_SIZE] % grad2.length;
        return grad2[idx];
    };

    const dot2 = (g, dx, dy) => g[0] * dx + g[1] * dy;
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10); // 5次補間（推奨）
    const lerp = (a, b, t) => a + t * (b - a);

    // グラジェントノイズ（シームレス版）
    // tx, ty: 0.0〜1.0 の UV座標
    const perlinTileable = (tx, ty) => {
        const u = tx * frequency;
        const v = ty * frequency;

        const x0 = Math.floor(u);
        const y0 = Math.floor(v);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const fu = fade(u - x0);
        const fv = fade(v - y0);

        // ★ ここで % frequency することで周期性を保証
        const g00 = gradHash(x0 % frequency, y0 % frequency);
        const g10 = gradHash(x1 % frequency, y0 % frequency);
        const g01 = gradHash(x0 % frequency, y1 % frequency);
        const g11 = gradHash(x1 % frequency, y1 % frequency);

        const n00 = dot2(g00, u - x0, v - y0);
        const n10 = dot2(g10, u - x1, v - y0);
        const n01 = dot2(g01, u - x0, v - y1);
        const n11 = dot2(g11, u - x1, v - y1);

        const nx0 = lerp(n00, n10, fu);
        const nx1 = lerp(n01, n11, fv);
        return lerp(nx0, nx1, fv) * 0.5 + 0.5; // 0〜1 に正規化
    };

    // --- テクスチャデータ生成 ---
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    const c1r = (c1 >> 16) & 0xFF, c1g = (c1 >> 8) & 0xFF, c1b = c1 & 0xFF;
    const c2r = (c2 >> 16) & 0xFF, c2g = (c2 >> 8) & 0xFF, c2b = c2 & 0xFF;

    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // UV は 0〜1（境界を含めない）
            const tx = x / size;
            const ty = y / size;
            const n = perlinTileable(tx, ty);

            const i = (y * size + x) * 4;
            data[i]     = lerp(c1r, c2r, n);
            data[i + 1] = lerp(c1g, c2g, n);
            data[i + 2] = lerp(c1b, c2b, n);
            data[i + 3] = 255;
        }
    }
    // CreateRGBATexture の引数
    // 第5引数: generateMipMaps (boolean)
    // 第6引数: invertY (boolean)
    // 第7引数: samplingMode (number)
    // 第8引数: type (number)
    const texture = BABYLON.RawTexture.CreateRGBATexture(
        data, 
        size, 
        size, 
        this.scene, 
        false, // generateMipMaps
        false, // invertY
        BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
        BABYLON.Constants.TEXTURETYPE_UNSIGNED_BYTE
    );

    if (repeat) {
        texture.uScale = 4.0;
        texture.vScale = 4.0;
        texture.wrapU = BABYLON.Texture.MIRROR_ADDRESSMODE;
        texture.wrapV = BABYLON.Texture.MIRROR_ADDRESSMODE;
    } else {
        texture.uScale = 1.0;
        texture.vScale = 1.0;
        texture.uOffset = 0.5;
    }

    return texture;
}
*/

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
                mat._emissiveBase.r + t,
                mat._emissiveBase.g + t,
                mat._emissiveBase.b + t
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
                // console.log("starvation:", this.class_name);
                GameState.spawn.activate_effect("Effect_Extinction", this.root.position, { size : this.collisionRadius});
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

        for (const attachment of this.attachments){
            attachment.dispose();
        }

        super.dispose();
    }

} // End of Spirit